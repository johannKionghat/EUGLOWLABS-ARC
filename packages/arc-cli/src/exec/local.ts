import { access, copyFile, readFile } from "node:fs/promises";

import { execa } from "execa";

import type { ExecChunk, ExecOpts, ExecResult, ExecutionAdapter } from "./types.js";

/**
 * `ExecutionAdapter` that runs commands and manipulates files on the
 * operator's machine via `execa` and `node:fs/promises`.
 *
 * Selected when `target: local` in `arc.config.yml` (see ADR-0009).
 *
 * The single-string `cmd` passed to `exec()` is run through the
 * native shell so users can rely on pipes, redirections and globbing
 * the same way they would on a remote VPS — the goal of the adapter
 * is shape-equivalence, not minimal-shell purity.
 */
export class LocalAdapter implements ExecutionAdapter {
  async exec(cmd: string, opts: ExecOpts = {}): Promise<ExecResult> {
    const start = Date.now();
    const child = execa(cmd, {
      shell: true,
      cwd: opts.cwd,
      env: opts.env,
      timeout: opts.timeoutMs,
      reject: false,
      stripFinalNewline: false,
      encoding: "utf8",
      buffer: true,
    });

    if (opts.onChunk) {
      child.stdout?.on("data", (data: Buffer | string) => {
        const chunk: ExecChunk = { stream: "stdout", data: data.toString() };
        opts.onChunk?.(chunk);
      });
      child.stderr?.on("data", (data: Buffer | string) => {
        const chunk: ExecChunk = { stream: "stderr", data: data.toString() };
        opts.onChunk?.(chunk);
      });
    }

    const result = await child;
    return {
      stdout: typeof result.stdout === "string" ? result.stdout : "",
      stderr: typeof result.stderr === "string" ? result.stderr : "",
      exitCode: result.exitCode ?? 0,
      durationMs: Date.now() - start,
    };
  }

  async copyFile(srcLocalPath: string, destPath: string): Promise<void> {
    await copyFile(srcLocalPath, destPath);
  }

  async readFile(path: string): Promise<string> {
    return readFile(path, "utf8");
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  describe(): string {
    return "local";
  }
}
