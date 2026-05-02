import type { ExecChunk, ExecutionAdapter } from "../exec/index.js";

export interface AnsibleRunOptions {
  /** Inventory path (passed via -i). Defaults to the playbook's inferred inventory. */
  inventory?: string;
  /** Extra vars passed via --extra-vars (key=value). */
  extraVars?: Record<string, string>;
  /** Run with --check (dry-run). */
  check?: boolean;
  /** Per-line stream callback. */
  onLine?: (line: string) => void;
}

export interface AnsibleRunResult {
  exitCode: number;
  durationMs: number;
}

/**
 * Invoke `ansible-playbook` through the given adapter and stream its
 * stdout/stderr line by line.
 *
 * The function does not assume `ansible` is present on the operator's
 * machine when target=vps — the adapter abstracts that away. For
 * target=local, the operator must have `ansible-playbook` on PATH;
 * for target=vps, the same binary must be on the remote PATH (or
 * provisioned by an earlier role).
 */
export async function runAnsiblePlaybook(
  adapter: ExecutionAdapter,
  playbookPath: string,
  opts: AnsibleRunOptions = {},
): Promise<AnsibleRunResult> {
  const args: string[] = [playbookPath];
  if (opts.inventory !== undefined) {
    args.unshift("-i", opts.inventory);
  }
  if (opts.check === true) {
    args.unshift("--check");
  }
  if (opts.extraVars !== undefined) {
    const extras = Object.entries(opts.extraVars)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    if (extras.length > 0) {
      args.unshift("--extra-vars", `"${extras}"`);
    }
  }

  const cmd = `ansible-playbook ${args.join(" ")}`;
  const start = Date.now();

  let buffer = "";
  const result = await adapter.exec(cmd, {
    onChunk: opts.onLine
      ? (chunk: ExecChunk) => {
          buffer += chunk.data;
          let newlineIndex = buffer.indexOf("\n");
          while (newlineIndex !== -1) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            opts.onLine?.(line);
            newlineIndex = buffer.indexOf("\n");
          }
        }
      : undefined,
  });

  if (buffer.length > 0 && opts.onLine !== undefined) {
    opts.onLine(buffer);
  }

  return {
    exitCode: result.exitCode,
    durationMs: Date.now() - start,
  };
}
