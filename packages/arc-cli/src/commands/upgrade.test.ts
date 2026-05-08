import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { runFromArgs } from "../cli.js";
import { formatVersion } from "../version.js";

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

describe("arc upgrade", () => {
  it("exits with code 0", async () => {
    const result = await run(["upgrade"]);
    expect(result.exitCode).toBe(0);
  });

  it("prints the curl one-liner pointing at install-arc.euglowlabs.com | sh", async () => {
    const result = await run(["upgrade"]);
    expect(result.stdout).toContain("curl -fsSL https://install-arc.euglowlabs.com | sh");
  });

  it("prints the current version metadata via formatVersion()", async () => {
    const result = await run(["upgrade"]);
    expect(result.stdout).toContain(formatVersion());
  });
});
