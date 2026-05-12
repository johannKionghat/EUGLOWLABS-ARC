import type { ExecutionAdapter } from "../exec/index.js";

/**
 * Package manager detected on the host. MVP supports only `apt`
 * (Ubuntu/Debian — the explicit target of docs/installation.md).
 * Other distros (dnf/yum/zypper) fall back to manual install
 * instructions — tracked for future expansion if community demands.
 */
export type PackageManager = "apt" | "unknown";

/**
 * Sudo / root status of the current user, as detected by querying
 * `id -u` and the presence of `sudo` on PATH.
 *
 * - `root: true` → no sudo needed, commands can run as-is.
 * - `root: false, sudoAvailable: true` → prefix commands with `sudo`.
 * - `root: false, sudoAvailable: false` → bootstrap impossible,
 *   fall back to manual install with a clear message.
 */
export interface SudoStatus {
  root: boolean;
  sudoAvailable: boolean;
}

/**
 * Detect whether `apt-get` is available on the host.
 *
 * MVP scope (CLI-029 design D1) : apt is the only auto-bootstrap target.
 * Other distros (`dnf`, `yum`, `zypper`) are documented as out-of-MVP
 * and return `'unknown'`.
 */
export async function detectPackageManager(adapter: ExecutionAdapter): Promise<PackageManager> {
  const result = await adapter.exec("which apt-get");
  return result.exitCode === 0 ? "apt" : "unknown";
}

/**
 * Detect root status and sudo availability on the host.
 *
 * - `id -u` is universally available on POSIX hosts. Output is the
 *   numeric UID — `"0"` means root.
 * - `which sudo` returns exit 0 if sudo is on PATH, non-zero otherwise.
 *
 * Short-circuit : when the user is already root, the sudo lookup is
 * skipped — sudo is irrelevant when running as UID 0.
 */
export async function checkSudoAvailable(adapter: ExecutionAdapter): Promise<SudoStatus> {
  const uidResult = await adapter.exec("id -u");
  const root = uidResult.stdout.trim() === "0";
  if (root) {
    return { root: true, sudoAvailable: false };
  }
  const sudoResult = await adapter.exec("which sudo");
  return { root: false, sudoAvailable: sudoResult.exitCode === 0 };
}
