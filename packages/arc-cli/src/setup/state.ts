import { chmod, readFile, writeFile } from "node:fs/promises";

import { z } from "zod";

import { arcStatePath } from "../paths.js";

/**
 * Current schema version of `~/.arc/state.json`.
 *
 * Bump when the on-disk shape changes incompatibly. `loadStateFile`
 * surfaces a warning when it reads a `schema_version` newer than this.
 */
export const STATE_SCHEMA_VERSION = 1 as const;

/**
 * On-disk shape of `~/.arc/state.json` (cf. INSTALL-002 Décision 5).
 *
 * Persisted at the END of a successful `arc setup --apply` — its
 * presence is the "transaction commit" marker. If apply fails before
 * this file is written, the previous state (if any) is preserved
 * intact.
 */
export const arcStateSchema = z.object({
  schema_version: z.literal(STATE_SCHEMA_VERSION),
  last_apply: z.string().datetime(),
  compose_files: z.array(z.string()),
  ansible_version: z.string(),
  playbook_run_id: z.string().uuid(),
});

export type ArcState = z.infer<typeof arcStateSchema>;

export type LoadStateResult =
  | { status: "absent" }
  | { status: "ok"; state: ArcState }
  | { status: "future_schema"; rawSchemaVersion: number; raw: unknown }
  | { status: "invalid"; raw: unknown; error: z.ZodError };

/**
 * Read and parse `~/.arc/state.json`.
 *
 * Returns a discriminated result so callers handle each case explicitly :
 * - `absent` — file does not exist (expected on first apply).
 * - `ok` — parsed and valid against {@link arcStateSchema}.
 * - `future_schema` — file exists but `schema_version > STATE_SCHEMA_VERSION`.
 *   Caller MUST surface a warning; we do not block since the user might
 *   have downgraded the CLI intentionally.
 * - `invalid` — JSON parse OK but schema validation failed.
 */
export async function loadStateFile(): Promise<LoadStateResult> {
  let content: string;
  try {
    content = await readFile(arcStatePath(), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: "absent" };
    }
    throw err;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (parseErr) {
    return {
      status: "invalid",
      raw: content,
      error: new z.ZodError([
        {
          code: "custom",
          path: [],
          message: `state.json is not valid JSON: ${(parseErr as Error).message}`,
        },
      ]),
    };
  }

  const detectedVersion =
    typeof raw === "object" && raw !== null && "schema_version" in raw
      ? Number((raw as { schema_version: unknown }).schema_version)
      : Number.NaN;
  if (Number.isFinite(detectedVersion) && detectedVersion > STATE_SCHEMA_VERSION) {
    return { status: "future_schema", rawSchemaVersion: detectedVersion, raw };
  }

  const parsed = arcStateSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "invalid", raw, error: parsed.error };
  }
  return { status: "ok", state: parsed.data };
}

/**
 * Atomically write `~/.arc/state.json` with mode 0600 (ADR-0015 +
 * INSTALL-002 Décision 6 — protect against secrets leaking via shared
 * volumes if state ever grows to embed any).
 *
 * "Atomic" here is the conventional `write tmp + rename` pattern so a
 * crash mid-write cannot leave a half-written file at the canonical
 * path. Caller should only invoke this AFTER ansible-playbook returns 0
 * — see {@link applyStack}.
 */
export async function writeStateFile(state: ArcState): Promise<void> {
  const path = arcStatePath();
  const tmp = `${path}.tmp`;
  const content = `${JSON.stringify(state, null, 2)}\n`;
  await writeFile(tmp, content, { encoding: "utf8", mode: 0o600 });
  // chmod again in case the umask masked the mode flag.
  await chmod(tmp, 0o600);
  const { rename } = await import("node:fs/promises");
  await rename(tmp, path);
}
