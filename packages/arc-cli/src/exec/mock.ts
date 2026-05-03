import type { ExecChunk, ExecOpts, ExecResult, ExecutionAdapter } from "./types.js";

type MockCall =
  | { method: "exec"; cmd: string; opts: ExecOpts | undefined }
  | { method: "copyFile"; src: string; dest: string }
  | { method: "readFile"; path: string }
  | { method: "fileExists"; path: string };

const DEFAULT_RESULT: ExecResult = {
  stdout: "",
  stderr: "",
  exitCode: 0,
  durationMs: 0,
};

/**
 * In-memory `ExecutionAdapter` for tests.
 *
 * Records every method call and lets tests program canned responses
 * for specific commands. The in-memory `files` map lets `copyFile`
 * and `seedFile` populate the virtual filesystem so `readFile` and
 * `fileExists` behave as expected.
 *
 * Real-world commands run through {@link HostAdapter}. This mock
 * exists so consumers (`arc deploy`, `arc status`, `arc backup`, ...)
 * can be unit-tested without touching the host shell.
 */
export class MockAdapter implements ExecutionAdapter {
  readonly calls: MockCall[] = [];
  private readonly execResponses = new Map<string, ExecResult>();
  private readonly files = new Map<string, string>();

  /** Program a canned response for the given exact command string. */
  programExec(cmd: string, response: Partial<ExecResult>): void {
    this.execResponses.set(cmd, { ...DEFAULT_RESULT, ...response });
  }

  /** Pre-populate the virtual filesystem (used as `readFile` source). */
  seedFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  async exec(cmd: string, opts?: ExecOpts): Promise<ExecResult> {
    this.calls.push({ method: "exec", cmd, opts });
    const response = this.execResponses.get(cmd) ?? DEFAULT_RESULT;
    if (opts?.onChunk) {
      if (response.stdout.length > 0) {
        const chunk: ExecChunk = { stream: "stdout", data: response.stdout };
        opts.onChunk(chunk);
      }
      if (response.stderr.length > 0) {
        const chunk: ExecChunk = { stream: "stderr", data: response.stderr };
        opts.onChunk(chunk);
      }
    }
    return response;
  }

  async copyFile(srcLocalPath: string, destPath: string): Promise<void> {
    this.calls.push({ method: "copyFile", src: srcLocalPath, dest: destPath });
    this.files.set(destPath, `<copied from ${srcLocalPath}>`);
  }

  async readFile(path: string): Promise<string> {
    this.calls.push({ method: "readFile", path });
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file on mock adapter — ${path}`);
    }
    return content;
  }

  async fileExists(path: string): Promise<boolean> {
    this.calls.push({ method: "fileExists", path });
    return this.files.has(path);
  }

  describe(): string {
    return "mock";
  }
}
