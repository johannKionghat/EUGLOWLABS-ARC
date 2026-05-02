import { readFile } from "node:fs/promises";

import { type ArcConfig, arcConfigSchema } from "@euglowlabs/arc-shared";
import { YAMLParseError, parse as parseYaml } from "yaml";

import { ConfigError, formatZodError } from "./errors.js";

interface NodeError extends Error {
  code?: string;
}

/**
 * Load an `arc.config.yml` file from disk, parse the YAML, and validate
 * it against `arcConfigSchema` (CLI-003). Returns a fully typed
 * {@link ArcConfig} on success.
 *
 * On failure, throws a {@link ConfigError} with a discriminated `kind`:
 * - `not-found` if the file does not exist
 * - `syntax` if the YAML cannot be parsed
 * - `schema` if the parsed object does not match `arcConfigSchema`
 *
 * @param filePath absolute or relative path to the config file
 */
export async function loadArcConfig(filePath: string): Promise<ArcConfig> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (cause) {
    if ((cause as NodeError).code === "ENOENT") {
      throw new ConfigError("not-found", `Config file not found: ${filePath}`, {
        path: filePath,
        cause,
      });
    }
    throw cause;
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (cause) {
    if (cause instanceof YAMLParseError) {
      const linePos = cause.linePos?.[0];
      throw new ConfigError("syntax", cause.message, {
        path: filePath,
        position: linePos ? { line: linePos.line, col: linePos.col } : undefined,
        cause,
      });
    }
    throw cause;
  }

  const result = arcConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigError("schema", "arc.config.yml validation failed", {
      path: filePath,
      issues: formatZodError(result.error),
      cause: result.error,
    });
  }

  return result.data;
}
