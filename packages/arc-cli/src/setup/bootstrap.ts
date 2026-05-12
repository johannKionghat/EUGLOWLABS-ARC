import { confirm, isCancel, note } from "@clack/prompts";

import type { ExecutionAdapter } from "../exec/index.js";

/**
 * Result of an `apt-get install` bootstrap call.
 *
 * Discrete status (no thrown error) so the caller in apply.ts can
 * compose it cleanly with the retry logic : on `ok: false`, the
 * `stderr` capture is shown to the user along with manual instructions.
 */
export interface BootstrapResult {
  ok: boolean;
  /** Captured stderr from the apt-get invocation when `ok: false`. */
  stderr?: string;
}

/**
 * Prompt the user to authorize automatic Ansible installation via
 * `apt-get install -y ansible` (CLI-029 design D2 — single confirm,
 * no auto-bypass).
 *
 * The message lists EXACTLY the commands that will be executed so the
 * user has full transparency before consenting. Ctrl+C / Esc returns
 * `false` (graceful, no thrown error).
 */
export async function promptAutoInstallAnsible(): Promise<boolean> {
  note(
    [
      "Ansible n'est pas installé sur cette machine.",
      "ARC peut l'installer automatiquement via :",
      "",
      "  sudo apt-get update",
      "  sudo apt-get install -y ansible",
      "",
      "Cela peut demander votre mot de passe sudo.",
    ].join("\n"),
  );

  const answer = await confirm({
    message: "Installer Ansible automatiquement ?",
    initialValue: true,
  });
  if (isCancel(answer)) return false;
  return answer === true;
}

/**
 * Run the `apt-get` bootstrap sequence for Ansible :
 *
 *   <sudo> DEBIAN_FRONTEND=noninteractive apt-get update -qq && \
 *   <sudo> DEBIAN_FRONTEND=noninteractive apt-get install -y ansible
 *
 * The two commands chain with `&&` so install runs only on update
 * success. `DEBIAN_FRONTEND=noninteractive` prevents apt from prompting
 * mid-install (e.g. service restart questions).
 *
 * stdout is streamed line-by-line via `process.stdout.write` so the
 * user sees progress as the install unfolds (pattern consistent with
 * apply.ts:405 for Ansible playbook output). On failure, the full
 * stderr is captured in the result for fail-clear display.
 *
 * @param adapter The execution adapter (HostAdapter in prod, MockAdapter in tests).
 * @param sudoPrefix `"sudo "` for non-root, `""` for root.
 */
export async function bootstrapAnsibleApt(
  adapter: ExecutionAdapter,
  sudoPrefix: string,
): Promise<BootstrapResult> {
  const cmd =
    `${sudoPrefix}DEBIAN_FRONTEND=noninteractive apt-get update -qq && ` +
    `${sudoPrefix}DEBIAN_FRONTEND=noninteractive apt-get install -y ansible`;

  const result = await adapter.exec(cmd, {
    onChunk: (chunk) => {
      if (chunk.stream === "stdout") {
        process.stdout.write(chunk.data);
      }
    },
  });

  if (result.exitCode === 0) {
    return { ok: true };
  }
  return { ok: false, stderr: result.stderr };
}
