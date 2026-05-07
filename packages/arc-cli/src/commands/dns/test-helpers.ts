import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import { runFromArgs } from "../../cli.js";

/**
 * Shared test helpers for src/commands/dns/*.test.ts.
 * Extracted in Phase B of DNS-001 to avoid 3-way duplication of tempCreds + run.
 *
 * NOT excluded from tsconfig: kept in build for typecheck safety; tree-shaken
 * out of the final binary (no production import path leads here).
 */

export function tempCreds(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "arc-dns-test-"));
  const path = join(dir, "cloudflare.env");
  writeFileSync(path, content, { mode: 0o600 });
  return path;
}

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function run(args: readonly string[]): Promise<RunResult> {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  stdout.on("data", (c: Buffer) => stdoutChunks.push(c));
  stderr.on("data", (c: Buffer) => stderrChunks.push(c));
  const exitCode = await runFromArgs(args, { stdout, stderr });
  return {
    exitCode,
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
  };
}

export function mockJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
