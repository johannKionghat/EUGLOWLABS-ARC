/**
 * One streamed chunk of process output.
 *
 * Implementations decode UTF-8 on the fly so consumers always see
 * `string` data — no `Buffer` plumbing.
 */
export interface ExecChunk {
  stream: "stdout" | "stderr";
  data: string;
}

/**
 * Options accepted by {@link ExecutionAdapter.exec}.
 *
 * - `cwd` / `env` mirror the standard child-process semantics.
 * - `onChunk` is called for every stdout/stderr chunk as it arrives,
 *   in addition to being captured into the final {@link ExecResult}.
 *   Use it to tail logs in real time.
 * - `timeoutMs` lets the adapter abort the process after the deadline;
 *   the resulting promise should reject with an `Error` whose `cause`
 *   carries the underlying signal/timeout reason.
 */
export interface ExecOpts {
  cwd?: string;
  env?: Record<string, string>;
  onChunk?: (chunk: ExecChunk) => void;
  timeoutMs?: number;
}

/**
 * Result of a completed `exec` call.
 *
 * `stdout` and `stderr` contain the full captured output (also
 * delivered piecewise via `onChunk` when set). `durationMs` is wall
 * time in milliseconds.
 */
export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

/**
 * Abstraction over "where" the CLI runs commands and copies files.
 *
 * Under the single-machine install model (ADR-0012) the only
 * production implementation is {@link HostAdapter} (execa +
 * `node:fs`). The interface is kept so tests can swap in
 * {@link MockAdapter} without touching the host shell.
 */
export interface ExecutionAdapter {
  /**
   * Execute a shell command and return its output. Runs through the
   * native shell on the host machine.
   */
  exec(cmd: string, opts?: ExecOpts): Promise<ExecResult>;

  /**
   * Copy a file on the host filesystem (semantically identical to
   * `fs.copyFile`).
   */
  copyFile(srcLocalPath: string, destPath: string): Promise<void>;

  /** Read a UTF-8 file from the adapter's filesystem. */
  readFile(path: string): Promise<string>;

  /** Whether `path` exists on the adapter's filesystem. */
  fileExists(path: string): Promise<boolean>;

  /**
   * Free-form label for logs and error messages.
   * Conventional values: `"host"`, `"mock"`.
   */
  describe(): string;
}
