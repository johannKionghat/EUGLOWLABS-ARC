import { beforeEach, describe, expect, it, vi } from "vitest";

// Queue-driven mock @clack/prompts (pattern cohérent apply.test.ts:7-34).
const promptQueue: unknown[] = [];

function nextPrompt(label: string): unknown {
  if (promptQueue.length === 0) {
    throw new Error(`prompt queue empty when ${label} was called`);
  }
  return promptQueue.shift();
}

vi.mock("@clack/prompts", () => ({
  note: vi.fn(),
  isCancel: (v: unknown) => v === Symbol.for("clack.cancel"),
  confirm: vi.fn(async () => nextPrompt("confirm")),
}));

// Subjects under test imported AFTER the mock declaration.
import { MockAdapter } from "../exec/index.js";
import { bootstrapAnsibleApt, promptAutoInstallAnsible } from "./bootstrap.js";

beforeEach(() => {
  promptQueue.length = 0;
});

describe("promptAutoInstallAnsible", () => {
  it("returns true when user answers yes (confirm → true)", async () => {
    promptQueue.push(true);
    expect(await promptAutoInstallAnsible()).toBe(true);
  });

  it("returns false when user answers no (confirm → false)", async () => {
    promptQueue.push(false);
    expect(await promptAutoInstallAnsible()).toBe(false);
  });

  it("returns false when user cancels (Ctrl+C → cancel symbol)", async () => {
    promptQueue.push(Symbol.for("clack.cancel"));
    expect(await promptAutoInstallAnsible()).toBe(false);
  });
});

describe("bootstrapAnsibleApt", () => {
  const SUDO_CMD =
    "sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq && " +
    "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y ansible";
  const ROOT_CMD =
    "DEBIAN_FRONTEND=noninteractive apt-get update -qq && " +
    "DEBIAN_FRONTEND=noninteractive apt-get install -y ansible";

  it("returns { ok: true } when apt-get install exits 0 (sudo prefix)", async () => {
    const adapter = new MockAdapter();
    adapter.programExec(SUDO_CMD, { exitCode: 0, stdout: "Setting up ansible...\n" });
    expect(await bootstrapAnsibleApt(adapter, "sudo ")).toEqual({ ok: true });
  });

  it("returns { ok: false, stderr } when apt-get install exits non-zero (root, no sudo)", async () => {
    const adapter = new MockAdapter();
    adapter.programExec(ROOT_CMD, {
      exitCode: 100,
      stdout: "",
      stderr: "E: Unable to locate package ansible",
    });
    expect(await bootstrapAnsibleApt(adapter, "")).toEqual({
      ok: false,
      stderr: "E: Unable to locate package ansible",
    });
  });
});
