import { describe, expect, it } from "vitest";

import { MockAdapter } from "./mock.js";
import type { ExecChunk } from "./types.js";

describe("MockAdapter", () => {
  it("returns a default 0-exit result for unprogrammed commands and records the call", async () => {
    const adapter = new MockAdapter();
    const result = await adapter.exec("anything");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(adapter.calls).toEqual([{ method: "exec", cmd: "anything", opts: undefined }]);
  });

  it("returns a programmed response and feeds onChunk for both streams", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("ls", {
      stdout: "a\nb\n",
      stderr: "warning\n",
      exitCode: 0,
      durationMs: 7,
    });

    const chunks: ExecChunk[] = [];
    const result = await adapter.exec("ls", { onChunk: (c) => chunks.push(c) });

    expect(result).toEqual({
      stdout: "a\nb\n",
      stderr: "warning\n",
      exitCode: 0,
      durationMs: 7,
    });
    expect(chunks).toEqual([
      { stream: "stdout", data: "a\nb\n" },
      { stream: "stderr", data: "warning\n" },
    ]);
  });

  it("makes copied files visible to fileExists and readFile", async () => {
    const adapter = new MockAdapter();
    await adapter.copyFile("/local/foo.yml", "/remote/foo.yml");

    expect(await adapter.fileExists("/remote/foo.yml")).toBe(true);
    expect(await adapter.readFile("/remote/foo.yml")).toContain("/local/foo.yml");
  });

  it("rejects readFile on a missing path and reports fileExists=false", async () => {
    const adapter = new MockAdapter();
    expect(await adapter.fileExists("/nope")).toBe(false);
    await expect(adapter.readFile("/nope")).rejects.toThrow(/ENOENT/);
    expect(adapter.describe()).toBe("mock");
  });
});
