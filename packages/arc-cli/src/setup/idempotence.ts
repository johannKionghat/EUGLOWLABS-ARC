import { readFile, stat } from "node:fs/promises";

import { type ArcConfig, arcConfigSchema } from "@euglowlabs/arc-shared";
import { YAMLParseError, parse as parseYaml } from "yaml";
import type { ZodError } from "zod";

import { arcConfigPath, arcUserDir } from "../paths.js";

/**
 * Discriminated result of {@link detectExistingConfig}.
 *
 * Six exclusive states, each carrying the raw context an orchestrator
 * needs to decide a corrective action without re-reading the filesystem.
 */
export type DetectionResult =
  | { status: "absent" }
  | { status: "valid"; config: ArcConfig }
  | { status: "corrupted"; raw: string; error: Error }
  | { status: "schema_mismatch"; raw: unknown; errors: ZodError }
  | { status: "permission_denied"; path: string; error: Error }
  | { status: "user_dir_invalid"; path: string; reason: string };

interface NodeError extends Error {
  code?: string;
}

/**
 * Pure detection of the `~/.arc/arc.config.yml` state.
 *
 * Read-only I/O + parsing only — no file mutation, no prompts, no
 * exits. The orchestrator (sous-tâche 3) consumes the {@link
 * DetectionResult} and decides the corrective action.
 *
 * Layout fixed by ADR-0015. The 6-case spec is frozen in the
 * `tasks/current.md` scratchpad and mirrored by `idempotence.test.ts`.
 */
export async function detectExistingConfig(): Promise<DetectionResult> {
  const dirPath = arcUserDir();
  const filePath = arcConfigPath();

  // Cas 6 — ~/.arc/ exists but is not a directory.
  try {
    const dirStat = await stat(dirPath);
    if (!dirStat.isDirectory()) {
      return {
        status: "user_dir_invalid",
        path: dirPath,
        reason: `${dirPath} exists but is not a directory`,
      };
    }
  } catch (cause) {
    const code = (cause as NodeError).code;
    if (code !== "ENOENT") {
      // Permission or other I/O error on the dir itself.
      return {
        status: "permission_denied",
        path: dirPath,
        error: cause as Error,
      };
    }
    // ENOENT on dir → file is necessarily absent too.
    return { status: "absent" };
  }

  // Cas 1 / 5 — read the file.
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (cause) {
    const code = (cause as NodeError).code;
    if (code === "ENOENT") {
      return { status: "absent" };
    }
    if (code === "EACCES" || code === "EPERM") {
      return {
        status: "permission_denied",
        path: filePath,
        error: cause as Error,
      };
    }
    throw cause;
  }

  // Cas 3 — YAML parse error.
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (cause) {
    if (cause instanceof YAMLParseError) {
      return { status: "corrupted", raw, error: cause };
    }
    throw cause;
  }

  // Cas 4 — schema mismatch.
  const result = arcConfigSchema.safeParse(parsed);
  if (!result.success) {
    return { status: "schema_mismatch", raw: parsed, errors: result.error };
  }

  // Cas 2 — valid.
  return { status: "valid", config: result.data };
}
