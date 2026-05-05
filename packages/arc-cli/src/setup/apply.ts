import type { ExecutionAdapter } from "../exec/index.js";

/**
 * Minimum `ansible-playbook` version we recommend (informative only).
 *
 * Below this we surface a warning but still proceed — `arc setup --apply`
 * is not blocked. Choice is arbitrary for the MVP and should be revisited
 * during E2E-001 once we know which distros ship with which versions.
 */
export const ANSIBLE_RECOMMENDED_MIN = { major: 2, minor: 14 } as const;

/**
 * Literal user-facing message displayed when `ansible-playbook` is not
 * installed on the host. Stored as a constant so E2E tests assert on
 * the exact string.
 */
export const ANSIBLE_NOT_INSTALLED_MESSAGE = `✗ Ansible n'est pas installé sur cette machine.

arc setup --apply nécessite Ansible pour orchestrer l'installation
de la stack. Installez-le selon votre OS :
  - Ubuntu/Debian : sudo apt install ansible
  - macOS : brew install ansible
  - Autre : https://docs.ansible.com/ansible/latest/installation_guide/

Puis relancez arc setup --apply.`;

/**
 * Thrown by {@link assertAnsibleInstalled} when `ansible-playbook` is
 * absent from the host (binary missing, ENOENT, shell exit 127).
 *
 * The orchestrate layer catches this and prints
 * {@link ANSIBLE_NOT_INSTALLED_MESSAGE} verbatim.
 */
export class AnsibleNotInstalledError extends Error {
  constructor() {
    super(ANSIBLE_NOT_INSTALLED_MESSAGE);
    this.name = "AnsibleNotInstalledError";
  }
}

/**
 * Thrown by {@link assertAnsibleInstalled} when `ansible-playbook` is
 * present but the `--version` invocation fails for any other reason
 * (non-zero exit, empty stdout, unparseable output).
 */
export class AnsibleExecutionError extends Error {
  readonly exitCode: number;
  readonly stderr: string;
  constructor(message: string, exitCode: number, stderr: string) {
    super(message);
    this.name = "AnsibleExecutionError";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

export interface AnsibleVersion {
  /** Detected version string, e.g. "2.16.3" or "2.10.0". */
  version: string;
  /** Set when the detected version is below {@link ANSIBLE_RECOMMENDED_MIN}. */
  warning?: string;
}

/**
 * Verify that `ansible-playbook` is callable on the host and capture
 * its version.
 *
 * Three outcomes :
 * - Binary absent (thrown error caught here, or shell exit 127) →
 *   throws {@link AnsibleNotInstalledError}.
 * - Binary present but `--version` failed (other non-zero exit, or
 *   empty/unparseable stdout) → throws {@link AnsibleExecutionError}.
 * - Success → returns the parsed version, optionally with a warning if
 *   it is below {@link ANSIBLE_RECOMMENDED_MIN}.
 */
export async function assertAnsibleInstalled(adapter: ExecutionAdapter): Promise<AnsibleVersion> {
  const cmd = "ansible-playbook --version";
  let result: Awaited<ReturnType<ExecutionAdapter["exec"]>>;
  try {
    result = await adapter.exec(cmd);
  } catch (cause) {
    // Thrown by HostAdapter only when execa itself fails to spawn the
    // shell (rare). Most "binary not found" cases land in exit 127
    // below because we run through `shell: true`.
    if (isEnoent(cause)) {
      throw new AnsibleNotInstalledError();
    }
    throw new AnsibleExecutionError(
      `ansible-playbook --version failed to spawn: ${(cause as Error).message}`,
      -1,
      "",
    );
  }

  if (result.exitCode === 127) {
    throw new AnsibleNotInstalledError();
  }
  if (result.exitCode !== 0) {
    throw new AnsibleExecutionError(
      `ansible-playbook --version exited with code ${result.exitCode}`,
      result.exitCode,
      result.stderr,
    );
  }

  const stdout = result.stdout.trim();
  if (stdout.length === 0) {
    throw new AnsibleExecutionError(
      "ansible-playbook --version returned empty stdout",
      result.exitCode,
      result.stderr,
    );
  }

  const version = parseAnsibleVersion(stdout);
  if (version === null) {
    throw new AnsibleExecutionError(
      `ansible-playbook --version output unparseable: ${stdout.split("\n")[0] ?? ""}`,
      result.exitCode,
      result.stderr,
    );
  }

  const warning = belowMin(version) ? buildVersionWarning(version) : undefined;
  return warning === undefined ? { version } : { version, warning };
}

/**
 * Parse the version string from the first line of `ansible-playbook --version`.
 *
 * Handles both formats observed in the wild :
 * - Modern (>= 2.10) : `ansible-playbook [core 2.16.3]` (sometimes followed by extras)
 * - Legacy (< 2.10) : `ansible-playbook 2.9.27`
 */
function parseAnsibleVersion(stdout: string): string | null {
  const firstLine = stdout.split("\n")[0]?.trim() ?? "";
  const coreMatch = firstLine.match(/\[core\s+([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
  if (coreMatch?.[1]) return coreMatch[1];
  const legacyMatch = firstLine.match(/ansible-playbook\s+([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
  if (legacyMatch?.[1]) return legacyMatch[1];
  return null;
}

function belowMin(version: string): boolean {
  const parts = version.split(".").map((p) => Number.parseInt(p, 10));
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  if (major < ANSIBLE_RECOMMENDED_MIN.major) return true;
  if (major > ANSIBLE_RECOMMENDED_MIN.major) return false;
  return minor < ANSIBLE_RECOMMENDED_MIN.minor;
}

function buildVersionWarning(version: string): string {
  return `ansible-playbook ${version} detected — version >= ${ANSIBLE_RECOMMENDED_MIN.major}.${ANSIBLE_RECOMMENDED_MIN.minor} recommended.`;
}

function isEnoent(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === "ENOENT";
}
