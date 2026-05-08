import { chmod, mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- mock @clack/prompts (queue-driven, same pattern as setup-e2e.test.ts) ---

const promptQueue: unknown[] = [];
const noteCalls: string[] = [];
const cancelCalls: string[] = [];

function nextPrompt(label: string): unknown {
  if (promptQueue.length === 0) {
    throw new Error(`prompt queue empty when ${label} was called`);
  }
  return promptQueue.shift();
}

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn((msg: string) => {
    cancelCalls.push(msg);
  }),
  note: vi.fn((msg: string) => {
    noteCalls.push(msg);
  }),
  isCancel: (v: unknown) => v === Symbol.for("clack.cancel"),
  text: vi.fn(async () => nextPrompt("text")),
  password: vi.fn(async () => nextPrompt("password")),
  select: vi.fn(async () => nextPrompt("select")),
  confirm: vi.fn(async () => nextPrompt("confirm")),
}));

// Subjects under test imported AFTER the mock declaration.
import type { ArcConfig } from "@euglowlabs/arc-shared";

import { MockAdapter } from "../exec/index.js";
import type { PlaybooksLoader } from "../playbooks-loader.js";
import {
  ANSIBLE_NOT_INSTALLED_MESSAGE,
  AnsibleExecutionError,
  AnsibleNotInstalledError,
  COMPOSE_FILES,
  FORCE_NOTICE,
  applyStack,
  assertAnsibleInstalled,
} from "./apply.js";
import { EXIT_CANCELLED, EXIT_ENV_ERROR, EXIT_OK } from "./exit-codes.js";
import { loadStateFile } from "./state.js";

/**
 * No-op loader used in `applyStack` tests so the production embedded
 * manifest is never extracted to `~/.arc/playbooks/` during unit tests
 * (keeps tests hermetic, consistent with the `MockAdapter` pattern).
 * DIST-001 1a-2.
 */
const noopLoader: PlaybooksLoader = {
  listPlaybooks: () => [],
  extractToDisk: async () => {},
};

const VERSION_CMD = "ansible-playbook --version";

// ---------------------------------------------------------------------------
// assertAnsibleInstalled — sub-task 3 (unchanged)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// applyStack — sub-task 4 (8 scenarios + permissions assertion bonus)
// ---------------------------------------------------------------------------

const sampleConfig: ArcConfig = {
  project: "johann-stack",
  domain: "mondomaine.dev",
  email: "johann@mondomaine.dev",
  dns: {
    provider: "cloudflare",
    zone: "mondomaine.dev",
    api_token: "cf-token-xyz",
  },
};

const ANSIBLE_VERSION_OK = {
  exitCode: 0,
  stdout: "ansible-playbook [core 2.16.3]\n  config file = None\n",
};

function programDefaultAnsible(adapter: MockAdapter): void {
  adapter.programExec(VERSION_CMD, ANSIBLE_VERSION_OK);
  // Match any ansible-playbook invocation on the bundled stub by
  // walking through the recorded exec calls in tests rather than
  // pre-programming an exact command string. The default MockAdapter
  // response is { exitCode: 0 } so the playbook invocation succeeds.
}

function dummyComposers() {
  return {
    prod: () => "version: '3'\nservices: {}\n",
    sandbox: () => "version: '3'\nservices: {}\n",
    agents: () => "version: '3'\nservices: {}\n",
  };
}

describe("applyStack", () => {
  let tmpHome: string;
  let arcDir: string;
  let composeDir: string;
  let statePath: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    originalHome = process.env.HOME;
    tmpHome = await mkdtemp(join(tmpdir(), "arc-apply-"));
    process.env.HOME = tmpHome;
    arcDir = join(tmpHome, ".arc");
    composeDir = join(arcDir, "compose");
    statePath = join(arcDir, "state.json");
    promptQueue.length = 0;
    noteCalls.length = 0;
    cancelCalls.length = 0;
  });

  afterEach(async () => {
    try {
      await chmod(arcDir, 0o755);
      await chmod(composeDir, 0o755);
    } catch {
      // ignore — paths may not exist or chmod may not apply on Windows.
    }
    await rm(tmpHome, { recursive: true, force: true });
    if (originalHome === undefined) {
      // biome-ignore lint/performance/noDelete: assigning undefined coerces to "undefined" string.
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  });

  it("1 — nominal run (no prior state) → composes generated, state.json committed, exit 0", async () => {
    const adapter = new MockAdapter();
    programDefaultAnsible(adapter);
    const code = await applyStack(sampleConfig, adapter, {
      composers: dummyComposers(),
      onAnsibleLine: () => {},
      loader: noopLoader,
    });
    expect(code).toBe(EXIT_OK);

    const composes = await readdir(composeDir);
    expect(composes.sort()).toEqual([...COMPOSE_FILES].sort());
    expect(composes.includes(".tmp")).toBe(false);

    const state = await loadStateFile();
    expect(state.status).toBe("ok");
    if (state.status !== "ok") throw new Error("unreachable");
    expect(state.state.schema_version).toBe(1);
    expect(state.state.compose_files).toEqual([...COMPOSE_FILES]);
    expect(state.state.ansible_version).toBe("2.16.3");
    expect(state.state.playbook_run_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("2 — state present + 'Annuler' → no FS write, no ansible call, exit 1", async () => {
    await mkdir(arcDir, { recursive: true });
    await mkdir(composeDir, { recursive: true });
    await writeFile(
      statePath,
      JSON.stringify({
        schema_version: 1,
        last_apply: "2026-05-04T10:00:00.000Z",
        compose_files: [...COMPOSE_FILES],
        ansible_version: "2.16.3",
        playbook_run_id: "11111111-1111-4111-8111-111111111111",
      }),
      "utf8",
    );
    promptQueue.push("cancel");
    const adapter = new MockAdapter();
    programDefaultAnsible(adapter);

    const code = await applyStack(sampleConfig, adapter, {
      composers: dummyComposers(),
      onAnsibleLine: () => {},
      loader: noopLoader,
      now: () => new Date("2026-05-04T14:00:00.000Z"),
    });
    expect(code).toBe(EXIT_CANCELLED);

    // No ansible-playbook invocation : only the version check ran.
    const ansiblePlaybookCalls = adapter.calls.filter(
      (c) =>
        c.method === "exec" &&
        c.cmd.startsWith("ansible-playbook ") &&
        c.cmd !== "ansible-playbook --version",
    );
    expect(ansiblePlaybookCalls).toHaveLength(0);

    // No compose files written.
    const composes = await readdir(composeDir);
    expect(composes).toEqual([]);
  });

  it("3 — state present + 'Réécrire' → composes rewritten, ansible re-invoked, state updated", async () => {
    await mkdir(arcDir, { recursive: true });
    await writeFile(
      statePath,
      JSON.stringify({
        schema_version: 1,
        last_apply: "2026-05-04T10:00:00.000Z",
        compose_files: [...COMPOSE_FILES],
        ansible_version: "2.16.3",
        playbook_run_id: "11111111-1111-4111-8111-111111111111",
      }),
      "utf8",
    );
    promptQueue.push("proceed");
    const adapter = new MockAdapter();
    programDefaultAnsible(adapter);

    const newDate = new Date("2026-05-05T09:00:00.000Z");
    const code = await applyStack(sampleConfig, adapter, {
      composers: dummyComposers(),
      onAnsibleLine: () => {},
      loader: noopLoader,
      now: () => newDate,
    });
    expect(code).toBe(EXIT_OK);

    const state = await loadStateFile();
    if (state.status !== "ok") throw new Error("expected ok state");
    expect(state.state.last_apply).toBe(newDate.toISOString());
    expect(state.state.playbook_run_id).not.toBe("11111111-1111-4111-8111-111111111111");
  });

  it("4 — --force + state present → no prompt, FORCE_NOTICE shown, applies directly", async () => {
    await mkdir(arcDir, { recursive: true });
    await writeFile(
      statePath,
      JSON.stringify({
        schema_version: 1,
        last_apply: "2026-05-04T10:00:00.000Z",
        compose_files: [...COMPOSE_FILES],
        ansible_version: "2.16.3",
        playbook_run_id: "11111111-1111-4111-8111-111111111111",
      }),
      "utf8",
    );
    const adapter = new MockAdapter();
    programDefaultAnsible(adapter);

    const code = await applyStack(sampleConfig, adapter, {
      force: true,
      composers: dummyComposers(),
      onAnsibleLine: () => {},
      loader: noopLoader,
    });
    expect(code).toBe(EXIT_OK);

    // No select() call → no entry consumed from promptQueue.
    expect(promptQueue.length).toBe(0);
    expect(noteCalls.some((m) => m.includes(FORCE_NOTICE))).toBe(true);
  });

  it("5 — composes present but state absent (partial reset) → 'détectés' wording, prompt cancel", async () => {
    await mkdir(composeDir, { recursive: true });
    for (const f of COMPOSE_FILES) {
      await writeFile(join(composeDir, f), "version: '3'\n", "utf8");
    }
    promptQueue.push("cancel");
    const adapter = new MockAdapter();
    programDefaultAnsible(adapter);

    const code = await applyStack(sampleConfig, adapter, {
      composers: dummyComposers(),
      onAnsibleLine: () => {},
      loader: noopLoader,
    });
    expect(code).toBe(EXIT_CANCELLED);

    // The note text differs from case 2 : no "déjà appliquée" wording.
    expect(noteCalls.some((m) => m.includes("Composes existants détectés"))).toBe(true);
    expect(noteCalls.some((m) => m.includes("déjà appliquée"))).toBe(false);
  });

  it.skipIf(platform() === "win32")(
    "6 — mkdir compose dir fails (permission denied) → exit 2, message names the path",
    async () => {
      await mkdir(arcDir, { recursive: true });
      await chmod(arcDir, 0o000);

      const adapter = new MockAdapter();
      programDefaultAnsible(adapter);
      const code = await applyStack(sampleConfig, adapter, {
        composers: dummyComposers(),
        onAnsibleLine: () => {},
        loader: noopLoader,
      });
      // Restore perms before assertions / cleanup.
      await chmod(arcDir, 0o755);

      expect(code).toBe(EXIT_ENV_ERROR);
      expect(cancelCalls.some((m) => m.includes(composeDir))).toBe(true);
    },
  );

  it("7 — compose generation throws → .tmp/ wiped, no state.json written, exit 2", async () => {
    const adapter = new MockAdapter();
    programDefaultAnsible(adapter);
    const composers = {
      prod: () => "version: '3'\n",
      sandbox: () => {
        throw new Error("boom: template render failure");
      },
      agents: () => "version: '3'\n",
    };
    const code = await applyStack(sampleConfig, adapter, {
      composers,
      onAnsibleLine: () => {},
      loader: noopLoader,
    });
    expect(code).toBe(EXIT_ENV_ERROR);
    expect(cancelCalls.some((m) => m.includes("Compose generation failed"))).toBe(true);

    // .tmp/ cleaned up.
    const tmp = join(composeDir, ".tmp");
    await expect(stat(tmp)).rejects.toThrow();

    // state.json not written.
    await expect(stat(statePath)).rejects.toThrow();
  });

  it("8 — ansible-playbook exits non-zero → composes left in place at final path, state.json absent, exit 2 (partial-state recovery via prompt on next run)", async () => {
    const adapter = new MockAdapter();
    adapter.programExec(VERSION_CMD, ANSIBLE_VERSION_OK);
    // Override exec to return non-zero on the playbook invocation but
    // still honour the version check.
    const realExec = adapter.exec.bind(adapter);
    adapter.exec = async (cmd, opts) => {
      if (cmd.startsWith("ansible-playbook ") && cmd !== VERSION_CMD) {
        return { stdout: "", stderr: "fatal: connection refused", exitCode: 4, durationMs: 0 };
      }
      return await realExec(cmd, opts);
    };

    const code = await applyStack(sampleConfig, adapter, {
      composers: dummyComposers(),
      onAnsibleLine: () => {},
      loader: noopLoader,
    });
    expect(code).toBe(EXIT_ENV_ERROR);
    expect(cancelCalls.some((m) => m.includes("ansible-playbook failed"))).toBe(true);
    expect(cancelCalls.some((m) => m.includes("left in place"))).toBe(true);

    // Composes ARE in the final dir (transaction model: rename pre-Ansible).
    const finals = (await readdir(composeDir)).filter((f) => f.endsWith(".yml")).sort();
    expect(finals).toEqual([...COMPOSE_FILES].sort());

    // .tmp/ is gone.
    const tmp = join(composeDir, ".tmp");
    await expect(stat(tmp)).rejects.toThrow();

    // state.json is absent — invariant: state.json present ⇒ ansible succeeded.
    await expect(stat(statePath)).rejects.toThrow();
  });

  it.skipIf(platform() === "win32")(
    "BONUS — compose dir is 0700, compose files and state.json are 0600 (ADR-0015 + Décision 6)",
    async () => {
      const adapter = new MockAdapter();
      programDefaultAnsible(adapter);
      const code = await applyStack(sampleConfig, adapter, {
        composers: dummyComposers(),
        onAnsibleLine: () => {},
        loader: noopLoader,
      });
      expect(code).toBe(EXIT_OK);

      const dirStat = await stat(composeDir);
      expect(dirStat.mode & 0o777).toBe(0o700);
      for (const f of COMPOSE_FILES) {
        const fileStat = await stat(join(composeDir, f));
        expect(fileStat.mode & 0o777).toBe(0o600);
      }
      const stateStat = await stat(statePath);
      expect(stateStat.mode & 0o777).toBe(0o600);
    },
  );
});
