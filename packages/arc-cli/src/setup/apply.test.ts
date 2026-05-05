import { describe, expect, it } from "vitest";

import { MockAdapter } from "../exec/index.js";
import {
  ANSIBLE_NOT_INSTALLED_MESSAGE,
  AnsibleExecutionError,
  AnsibleNotInstalledError,
  assertAnsibleInstalled,
} from "./apply.js";

const VERSION_CMD = "ansible-playbook --version";

describe("assertAnsibleInstalled", () => {
  it("returns the parsed version on a modern (>= 2.14) install", async () => {
    const adapter = new MockAdapter();
    adapter.programExec(VERSION_CMD, {
      exitCode: 0,
      stdout: [
        "ansible-playbook [core 2.16.3]",
        "  config file = None",
        "  python version = 3.11.9",
      ].join("\n"),
    });
    const result = await assertAnsibleInstalled(adapter);
    expect(result.version).toBe("2.16.3");
    expect(result.warning).toBeUndefined();
  });

  it("returns a warning for a legacy (< 2.14) install but does not throw", async () => {
    const adapter = new MockAdapter();
    adapter.programExec(VERSION_CMD, {
      exitCode: 0,
      stdout: ["ansible-playbook 2.10.0", "  config file = None"].join("\n"),
    });
    const result = await assertAnsibleInstalled(adapter);
    expect(result.version).toBe("2.10.0");
    expect(result.warning).toContain("recommended");
    expect(result.warning).toContain("2.10.0");
  });

  it("throws AnsibleNotInstalledError when shell exits 127 (binary absent)", async () => {
    const adapter = new MockAdapter();
    adapter.programExec(VERSION_CMD, {
      exitCode: 127,
      stderr: "/bin/sh: ansible-playbook: command not found",
    });
    await expect(assertAnsibleInstalled(adapter)).rejects.toBeInstanceOf(AnsibleNotInstalledError);
    await expect(assertAnsibleInstalled(adapter)).rejects.toThrow(ANSIBLE_NOT_INSTALLED_MESSAGE);
  });

  it("throws AnsibleNotInstalledError when adapter rejects with ENOENT", async () => {
    const adapter = new MockAdapter();
    // Override exec to throw ENOENT.
    adapter.exec = async () => {
      const err = new Error("spawn ansible-playbook ENOENT") as Error & { code?: string };
      err.code = "ENOENT";
      throw err;
    };
    await expect(assertAnsibleInstalled(adapter)).rejects.toBeInstanceOf(AnsibleNotInstalledError);
  });

  it("throws AnsibleExecutionError on non-zero exit (other than 127)", async () => {
    const adapter = new MockAdapter();
    adapter.programExec(VERSION_CMD, {
      exitCode: 1,
      stderr: "fatal: corrupted python install",
    });
    const err = await assertAnsibleInstalled(adapter).catch((e) => e);
    expect(err).toBeInstanceOf(AnsibleExecutionError);
    expect((err as AnsibleExecutionError).exitCode).toBe(1);
    expect((err as AnsibleExecutionError).stderr).toContain("corrupted");
  });

  it("throws AnsibleExecutionError when stdout is empty (degenerate case)", async () => {
    const adapter = new MockAdapter();
    adapter.programExec(VERSION_CMD, { exitCode: 0, stdout: "" });
    await expect(assertAnsibleInstalled(adapter)).rejects.toBeInstanceOf(AnsibleExecutionError);
  });

  it("throws AnsibleExecutionError when stdout is unparseable", async () => {
    const adapter = new MockAdapter();
    adapter.programExec(VERSION_CMD, {
      exitCode: 0,
      stdout: "garbled output with no version-looking thing",
    });
    await expect(assertAnsibleInstalled(adapter)).rejects.toBeInstanceOf(AnsibleExecutionError);
  });
});

describe("ANSIBLE_NOT_INSTALLED_MESSAGE — literal contract", () => {
  it("contains the four key install lines (Ubuntu/Debian, macOS, Autre, relancez)", () => {
    expect(ANSIBLE_NOT_INSTALLED_MESSAGE).toContain(
      "Ansible n'est pas installé sur cette machine.",
    );
    expect(ANSIBLE_NOT_INSTALLED_MESSAGE).toContain("Ubuntu/Debian : sudo apt install ansible");
    expect(ANSIBLE_NOT_INSTALLED_MESSAGE).toContain("macOS : brew install ansible");
    expect(ANSIBLE_NOT_INSTALLED_MESSAGE).toContain(
      "https://docs.ansible.com/ansible/latest/installation_guide/",
    );
    expect(ANSIBLE_NOT_INSTALLED_MESSAGE).toContain("Puis relancez arc setup --apply.");
  });
});
