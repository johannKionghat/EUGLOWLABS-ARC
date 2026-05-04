import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Source of truth for user-facing artifact paths under `~/.arc/`.
 *
 * Layout fixed by ADR-0015 (`docs/03-architecture-decisions/0015-layout-arc-user-artifacts.md`).
 * Every file or command that reads or writes a user artifact MUST go
 * through these helpers — no hardcoded `~/.arc/...` strings elsewhere.
 *
 * Resolution honours `process.env.HOME` first (lets tests override the
 * home directory without touching the OS), then falls back to
 * `os.homedir()` for production paths.
 */

function resolveHome(): string {
  return process.env.HOME ?? homedir();
}

/**
 * Absolute path to the per-user ARC artifact directory (`~/.arc`).
 *
 * The directory itself is created on demand by callers that write into
 * it (typically `arc setup`); this helper only computes the path.
 */
export function arcUserDir(): string {
  return join(resolveHome(), ".arc");
}

/**
 * Absolute path to the main ARC config file (`~/.arc/arc.config.yml`).
 */
export function arcConfigPath(): string {
  return join(arcUserDir(), "arc.config.yml");
}
