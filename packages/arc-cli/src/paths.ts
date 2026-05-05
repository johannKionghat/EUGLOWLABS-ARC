import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

/**
 * Absolute path to the directory holding generated docker composes
 * (`~/.arc/compose/`). Created by `applyStack` (INSTALL-002) with mode
 * 0755. See ADR-0015.
 */
export function arcComposeDir(): string {
  return join(arcUserDir(), "compose");
}

/**
 * Absolute path to the directory holding local secrets like the ARC
 * Agent token (`~/.arc/credentials/`). Created on demand with mode 0700
 * (owner-only). See ADR-0015.
 */
export function arcCredentialsDir(): string {
  return join(arcUserDir(), "credentials");
}

/**
 * Absolute path to the runtime state file (`~/.arc/state.json`).
 *
 * Holds at least `{ schema_version, last_apply, compose_files }` after
 * a successful `arc setup --apply`. Used by `applyStack` (INSTALL-002)
 * for idempotence detection.
 */
export function arcStatePath(): string {
  return join(arcUserDir(), "state.json");
}

/**
 * Absolute path to the bundled Ansible playbook shipped with arc-cli
 * (`<package>/playbooks/setup.yml`).
 *
 * Resolution works identically from both `src/paths.ts` (dev/tests) and
 * `dist/paths.js` (npm install) because both files sit one level below
 * the package root. The `playbooks/` directory MUST be listed in
 * `package.json#files` so it ships in the published tarball.
 *
 * Caller is responsible for verifying existence before invoking
 * `ansible-playbook` — this helper only computes the path.
 *
 * NOTE on `bun build --compile` (CLI-025): single-binary asset bundling
 * for this playbook is tracked separately. Until then, the binary
 * resolves to a path next to itself, which is fine for npm/Homebrew
 * installs but may need an `--asset` flag in the build script.
 */
export function bundledPlaybookPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "playbooks", "setup.yml");
}
