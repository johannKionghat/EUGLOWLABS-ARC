import { access, writeFile } from "node:fs/promises";

import type { ArcConfig } from "@euglowlabs/arc-shared";

import { serializeArcConfig } from "./serialize.js";

export interface WriteArcConfigOptions {
  /** Overwrite an existing file at `path`. Default: false. */
  force?: boolean;
}

/**
 * Serialize and write an `arc.config.yml` to disk.
 *
 * Refuses to overwrite an existing file unless `force: true` is passed.
 * The error thrown in that case is a regular `Error` (not a {@link
 * ConfigError}); callers may surface its message directly.
 */
export async function writeArcConfig(
  path: string,
  cfg: Partial<ArcConfig>,
  options: WriteArcConfigOptions = {},
): Promise<void> {
  const force = options.force ?? false;
  if (!force) {
    const exists = await pathExists(path);
    if (exists) {
      throw new Error(`${path} already exists; pass --force to overwrite`);
    }
  }
  const yaml = serializeArcConfig(cfg);
  await writeFile(path, yaml, "utf8");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
