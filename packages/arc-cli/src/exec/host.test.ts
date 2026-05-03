import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HostAdapter } from "./host.js";
import type { ExecChunk } from "./types.js";

const isWindows = platform() === "win32";

describe("HostAdapter", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "arc-host-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("runs a basic shell command and captures stdout", async () => {
    const adapter = new HostAdapter();
    const cmd = isWindows ? "echo hello-arc" : "printf hello-arc";
    const result = await adapter.exec(cmd);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hello-arc");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns a non-zero exit code for a failing command", async () => {
    const adapter = new HostAdapter();
    const cmd = isWindows ? "exit 7" : "sh -c 'exit 7'";
    const result = await adapter.exec(cmd);
    expect(result.exitCode).toBe(7);
  });

  it("streams stdout chunks via onChunk", async () => {
    const adapter = new HostAdapter();
    const chunks: ExecChunk[] = [];
    const cmd = isWindows ? "echo line1" : "printf 'line1\\n'";
    await adapter.exec(cmd, { onChunk: (c) => chunks.push(c) });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some((c) => c.stream === "stdout")).toBe(true);
  });

  it("copyFile / readFile / fileExists round-trip", async () => {
    const adapter = new HostAdapter();
    const src = join(dir, "src.txt");
    const dest = join(dir, "dest.txt");
    await writeFile(src, "payload", "utf8");

    expect(await adapter.fileExists(src)).toBe(true);
    expect(await adapter.fileExists(dest)).toBe(false);

    await adapter.copyFile(src, dest);
    expect(await adapter.fileExists(dest)).toBe(true);
    expect(await adapter.readFile(dest)).toBe("payload");
  });

  it("describe() returns 'host'", () => {
    expect(new HostAdapter().describe()).toBe("host");
  });
});
