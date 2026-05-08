import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { runFromArgs } from "./cli.js";
import { VERSION, formatVersion } from "./version.js";

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
    // DIST-001 1a-3 : `arc version` prints the full ADR-0016 §1
    // "X.Y.Z (sha=ABC, built=ISO_DATE)" rendering. The clipanion
    // built-in --version flag still prints the short form (asserted
    // by the next test).
    expect(result.stdout).toBe(`arc ${formatVersion()}\n`);
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

  it("renders the ASCII banner on `arc help`", async () => {
    const result = await run(["help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("EuglowLabs ARC");
    expect(result.stdout).toContain("Autonomous Resource Cloud");
    // The ASCII frame is the unique marker of the banner.
    expect(result.stdout).toContain("+----------------------------------------------------------+");
    // Usage section must follow the banner and list registered commands.
    expect(result.stdout).toContain("arc version");
    expect(result.stdout).toContain("arc init");
  });

  it("renders the ASCII banner on `--help`", async () => {
    const result = await run(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("+----------------------------------------------------------+");
  });

  it("does NOT render the banner on subcommand help", async () => {
    const result = await run(["version", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain(
      "+----------------------------------------------------------+",
    );
  });
});
