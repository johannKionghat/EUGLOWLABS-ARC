import { describe, expect, it } from "vitest";

import { MockAdapter } from "../exec/index.js";
import { checkSudoAvailable, detectPackageManager } from "./prerequisites.js";

describe("detectPackageManager", () => {
  it("returns 'apt' when which apt-get exits 0", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("which apt-get", { exitCode: 0, stdout: "/usr/bin/apt-get\n" });
    expect(await detectPackageManager(adapter)).toBe("apt");
  });

  it("returns 'unknown' when which apt-get exits non-zero (e.g. Fedora, Arch)", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("which apt-get", { exitCode: 1, stderr: "" });
    expect(await detectPackageManager(adapter)).toBe("unknown");
  });
});

describe("checkSudoAvailable", () => {
  it("returns { root: true, sudoAvailable: false } when user is root and skips sudo lookup", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("id -u", { exitCode: 0, stdout: "0\n" });
    const result = await checkSudoAvailable(adapter);
    expect(result).toEqual({ root: true, sudoAvailable: false });
    // Confirm sudo lookup was NOT performed (short-circuit).
    expect(adapter.calls.some((c) => c.method === "exec" && c.cmd === "which sudo")).toBe(false);
  });

  it("returns { root: false, sudoAvailable: true } for non-root user with sudo on PATH", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("id -u", { exitCode: 0, stdout: "1000\n" });
    adapter.programExec("which sudo", { exitCode: 0, stdout: "/usr/bin/sudo\n" });
    expect(await checkSudoAvailable(adapter)).toEqual({ root: false, sudoAvailable: true });
  });

  it("returns { root: false, sudoAvailable: false } for non-root user without sudo", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("id -u", { exitCode: 0, stdout: "1000\n" });
    adapter.programExec("which sudo", { exitCode: 1 });
    expect(await checkSudoAvailable(adapter)).toEqual({ root: false, sudoAvailable: false });
  });
});
