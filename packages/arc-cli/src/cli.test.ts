import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { runFromArgs } from "./cli.js";
import { VERSION } from "./version.js";

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function run(args: readonly string[]): Promise<RunResult> {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
  stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

  const exitCode = await runFromArgs(args, { stdout, stderr });

  return {
    exitCode,
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
  };
}

describe("arc CLI", () => {
  it("prints version via `version` subcommand", async () => {
    const result = await run(["version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(`arc ${VERSION}\n`);
    expect(result.stderr).toBe("");
  });

  it("prints version via `--version` flag", async () => {
    const result = await run(["--version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(VERSION);
  });

  it("prints help when invoked with no arguments", async () => {
    const result = await run([]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("arc");
  });

  it("exits non-zero on unknown command", async () => {
    const result = await run(["doesnotexist"]);
    expect(result.exitCode).not.toBe(0);
    // Clipanion 4 RC4 routes its error output through stdout; the
    // contract we care about is the non-zero exit code plus a
    // non-empty user-facing message somewhere.
    expect(result.stdout + result.stderr).not.toBe("");
  });
});
