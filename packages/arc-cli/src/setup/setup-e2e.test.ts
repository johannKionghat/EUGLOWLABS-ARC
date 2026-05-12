/**
 * E2E tests for `arc setup` going through the real CLI factory.
 *
 * Pourquoi un mock @clack/prompts ici aussi (et pas seulement en
 * sous-tâche 3) : la sélection clack utilise stdin en raw mode TTY
 * (touches fléchées + Enter). Driver cela depuis Vitest sans TTY
 * réel demande soit `node-pty` (dep lourde) soit un sous-process,
 * deux options qui sortent du budget INSTALL-001 et qu'on évite tant
 * que la roadmap E2E-001 n'est pas livrée.
 *
 * Ce qui est testé ici (couche supplémentaire vs sous-tâche 3) :
 * - Le binding Clipanion `SetupCommand` est exercé via runFromArgs.
 * - Le code de sortie est correctement propagé à travers la CLI factory.
 * - Les effets de système de fichiers (création/backup/non-écriture)
 *   sont vérifiés sur un HOME isolé (tmpdir) après chaque scénario.
 * - La détection idempotence n'est PAS mockée — on lui passe une vraie
 *   structure fs et on lit le résultat (vrai chemin code → fs).
 *
 * Le smoke test real-run, séparé, couvre l'UX terminal (couleurs,
 * Ctrl+C, alignement) que cette suite ne peut pas valider.
 */

import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stringify as yamlStringify } from "yaml";

// ---- mock @clack/prompts (cf. en-tête) ------------------------------------

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

// ---- mock ../exec/index.js (sub-task 6) ---------------------------------
//
// applyStack instantiates `new HostAdapter()` to talk to the host
// shell. For E2E we replace it with a fake adapter so `ansible-playbook`
// is never spawned for real. `vi.hoisted` is required because vi.mock
// factories are hoisted above any top-level `class` / `let` — using
// hoisted state lets the factory close over a mutable handler that
// individual tests reprogram via `programAnsibleOk()` etc.

const { execHandlerRef, FakeHostAdapter } = vi.hoisted(() => {
  const ref: {
    handler: (
      cmd: string,
      opts?: unknown,
    ) => Promise<{
      stdout: string;
      stderr: string;
      exitCode: number;
      durationMs: number;
    }>;
  } = {
    handler: async () => ({ stdout: "", stderr: "", exitCode: 0, durationMs: 0 }),
  };
  class FakeHostAdapter {
    async exec(cmd: string, opts?: unknown) {
      return await ref.handler(cmd, opts);
    }
    async copyFile(): Promise<void> {}
    async readFile(): Promise<string> {
      return "";
    }
    async fileExists(): Promise<boolean> {
      return false;
    }
    describe(): string {
      return "fake-host";
    }
  }
  return { execHandlerRef: ref, FakeHostAdapter };
});

vi.mock("../exec/index.js", async () => {
  const actual = await vi.importActual<typeof import("../exec/index.js")>("../exec/index.js");
  return {
    ...actual,
    HostAdapter: FakeHostAdapter,
  };
});

// Subject under test imported AFTER mock declarations.
import { runFromArgs } from "../cli.js";
import { ANSIBLE_NOT_INSTALLED_MESSAGE, COMPOSE_FILES } from "./apply.js";
import { APPLY_SUCCESS_TEMPLATE } from "./orchestrate.js";

// ---- helpers --------------------------------------------------------------

const validConfig = {
  project: "johann-stack",
  domain: "mondomaine.dev",
  email: "johann@mondomaine.dev",
  dns: {
    provider: "cloudflare" as const,
    zone: "mondomaine.dev",
    api_token: "cf-token-original",
  },
};

const fresh = {
  project: "fresh-stack",
  domain: "fresh.dev",
  email: "fresh@fresh.dev",
  dnsZone: "fresh.dev",
  dnsToken: "cf-token-fresh",
};

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runSetupCli(extraArgs: readonly string[] = []): Promise<RunResult> {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
  stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
  const exitCode = await runFromArgs(["setup", ...extraArgs], { stdout, stderr });
  return {
    exitCode,
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
  };
}

const ANSIBLE_VERSION_OK = {
  stdout: "ansible-playbook [core 2.16.3]\n  config file = None\n",
  stderr: "",
  exitCode: 0,
  durationMs: 0,
};

/** Programmable Ansible-aware exec router. Default = success on any cmd. */
function programAnsibleOk(): void {
  execHandlerRef.handler = async (cmd) => {
    if (cmd === "ansible-playbook --version") return ANSIBLE_VERSION_OK;
    if (cmd.startsWith("ansible-playbook ")) {
      return { stdout: "stub OK", stderr: "", exitCode: 0, durationMs: 0 };
    }
    return { stdout: "", stderr: "", exitCode: 0, durationMs: 0 };
  };
}

function programAnsibleAbsent(): void {
  execHandlerRef.handler = async (cmd) => {
    if (cmd === "ansible-playbook --version") {
      return {
        stdout: "",
        stderr: "/bin/sh: ansible-playbook: command not found",
        exitCode: 127,
        durationMs: 0,
      };
    }
    // CLI-029 1c : ensureAnsible probes the package manager to decide
    // if auto-bootstrap is possible. Simulate "apt absent" so the
    // bootstrap branch falls through immediately to the legacy
    // ANSIBLE_NOT_INSTALLED_MESSAGE — preserves the pre-CLI-029
    // semantics of E2E-11 (no prompt shown, exit 2).
    if (cmd === "which apt-get") {
      return { stdout: "", stderr: "", exitCode: 1, durationMs: 0 };
    }
    // Any other unexpected command after Ansible absent must NOT happen.
    throw new Error(`unexpected exec(${cmd}) after ansible-playbook absent`);
  };
}

// ---- suite ----------------------------------------------------------------

describe("arc setup — E2E through CLI factory", () => {
  let tmpHome: string;
  let arcDir: string;
  let configFile: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    originalHome = process.env.HOME;
    tmpHome = await mkdtemp(join(tmpdir(), "arc-setup-e2e-"));
    process.env.HOME = tmpHome;
    arcDir = join(tmpHome, ".arc");
    configFile = join(arcDir, "arc.config.yml");
    promptQueue.length = 0;
    noteCalls.length = 0;
    cancelCalls.length = 0;
    // Default exec : success on every command (incl. unmocked ansible).
    execHandlerRef.handler = async () => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 0,
    });
  });

  afterEach(async () => {
    try {
      await chmod(arcDir, 0o755);
      await chmod(configFile, 0o644);
    } catch {
      // ignore — paths may not exist or chmod may not apply on Windows.
    }
    await rm(tmpHome, { recursive: true, force: true });
    if (originalHome === undefined) {
      // biome-ignore lint/performance/noDelete: assigning undefined coerces to "undefined" string in process.env, only delete unsets the variable.
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  });

  it("E2E-1 — premier setup (absent) → écrit ~/.arc/arc.config.yml + exit 0", async () => {
    promptQueue.push(fresh.project, fresh.domain, fresh.email, fresh.dnsZone, fresh.dnsToken);
    const r = await runSetupCli();
    expect(r.exitCode).toBe(0);
    const written = await readFile(configFile, "utf8");
    expect(written).toContain(`project: ${fresh.project}`);
    expect(written).toContain(`api_token: ${fresh.dnsToken}`);
  });

  it("E2E-2 — config valide + Réutiliser → fichier inchangé + exit 0", async () => {
    await mkdir(arcDir, { recursive: true });
    const yaml = yamlStringify(validConfig);
    await writeFile(configFile, yaml, "utf8");
    promptQueue.push("reuse");
    const r = await runSetupCli();
    expect(r.exitCode).toBe(0);
    const after = await readFile(configFile, "utf8");
    expect(after).toBe(yaml);
  });

  it("E2E-3 — config valide + Réécrire → fichier réécrit avec nouvelles valeurs", async () => {
    await mkdir(arcDir, { recursive: true });
    await writeFile(configFile, yamlStringify(validConfig), "utf8");
    promptQueue.push(
      "rewrite",
      "rewritten-stack",
      validConfig.domain,
      "new@mondomaine.dev",
      validConfig.dns.zone,
      "cf-token-rewritten",
    );
    const r = await runSetupCli();
    expect(r.exitCode).toBe(0);
    const after = await readFile(configFile, "utf8");
    expect(after).toContain("project: rewritten-stack");
    expect(after).toContain("email: new@mondomaine.dev");
    expect(after).toContain("api_token: cf-token-rewritten");
  });

  it("E2E-4 — config valide + Annuler → fichier inchangé + exit 1", async () => {
    await mkdir(arcDir, { recursive: true });
    const yaml = yamlStringify(validConfig);
    await writeFile(configFile, yaml, "utf8");
    promptQueue.push("cancel");
    const r = await runSetupCli();
    expect(r.exitCode).toBe(1);
    const after = await readFile(configFile, "utf8");
    expect(after).toBe(yaml);
  });

  it("E2E-5 — config corrompue + Backup → .broken-<ts> créé + nouveau config + exit 0", async () => {
    await mkdir(arcDir, { recursive: true });
    await writeFile(configFile, "garbage:::\n", "utf8");
    promptQueue.push(
      "backup",
      fresh.project,
      fresh.domain,
      fresh.email,
      fresh.dnsZone,
      fresh.dnsToken,
    );
    const r = await runSetupCli();
    expect(r.exitCode).toBe(0);
    const after = await readFile(configFile, "utf8");
    expect(after).toContain(`project: ${fresh.project}`);
    const entries = await readdir(arcDir);
    expect(entries.some((e) => e.startsWith("arc.config.yml.broken-"))).toBe(true);
  });

  it("E2E-6 — config corrompue + Annuler → fichier inchangé + aucun .broken + exit 1", async () => {
    await mkdir(arcDir, { recursive: true });
    const original = "garbage:::\n";
    await writeFile(configFile, original, "utf8");
    promptQueue.push("cancel");
    const r = await runSetupCli();
    expect(r.exitCode).toBe(1);
    const after = await readFile(configFile, "utf8");
    expect(after).toBe(original);
    const entries = await readdir(arcDir);
    expect(entries.some((e) => e.startsWith("arc.config.yml.broken-"))).toBe(false);
  });

  it.skipIf(platform() === "win32")(
    "E2E-7 — permission denied → exit 2 + fichier inchangé",
    async () => {
      await mkdir(arcDir, { recursive: true });
      const yaml = yamlStringify(validConfig);
      await writeFile(configFile, yaml, "utf8");
      await chmod(configFile, 0o000);
      const r = await runSetupCli();
      expect(r.exitCode).toBe(2);
      // Restore perms for the assert read.
      await chmod(configFile, 0o644);
      const after = await readFile(configFile, "utf8");
      expect(after).toBe(yaml);
    },
  );

  it("E2E-8 — ~/.arc est un fichier (user_dir_invalid) → exit 2 + fichier inchangé", async () => {
    const original = "this should be a directory";
    await writeFile(arcDir, original, "utf8");
    const r = await runSetupCli();
    expect(r.exitCode).toBe(2);
    const after = await readFile(arcDir, "utf8");
    expect(after).toBe(original);
  });

  // -------------------------------------------------------------------------
  // INSTALL-002 sub-task 6 — `arc setup --apply` end-to-end through the CLI
  // factory. Ansible is mocked at the HostAdapter level (cf. en-tête).
  // -------------------------------------------------------------------------

  it("E2E-9 — apply + config absente → composes générés, state.json créé, exit 0", async () => {
    programAnsibleOk();
    promptQueue.push(fresh.project, fresh.domain, fresh.email, fresh.dnsZone, fresh.dnsToken);

    const r = await runSetupCli(["--apply"]);
    expect(r.exitCode).toBe(0);

    // Config persisted.
    const written = await readFile(configFile, "utf8");
    expect(written).toContain(`project: ${fresh.project}`);

    // Composes generated under ~/.arc/compose/ with the real names.
    const composeDir = join(arcDir, "compose");
    const composes = (await readdir(composeDir)).filter((f) => f.endsWith(".yml")).sort();
    expect(composes).toEqual([...COMPOSE_FILES].sort());

    // state.json committed with a valid schema shape.
    const stateRaw = await readFile(join(arcDir, "state.json"), "utf8");
    const state = JSON.parse(stateRaw);
    expect(state.schema_version).toBe(1);
    expect(typeof state.last_apply).toBe("string");
    expect(new Date(state.last_apply).toISOString()).toBe(state.last_apply); // ISO 8601
    expect(state.compose_files).toEqual([...COMPOSE_FILES]);
    expect(state.ansible_version).toBe("2.16.3");
    expect(state.playbook_run_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    // Literal success message surfaced via clack note().
    const successShown = noteCalls.some((m) => m.includes("✓ Stack ARC appliquée avec succès."));
    expect(successShown).toBe(true);
    expect(noteCalls.some((m) => m.includes("Composes générés dans ~/.arc/compose/."))).toBe(true);
    expect(noteCalls.some((m) => m.includes("Étapes suivantes"))).toBe(true);
    // Run id substituted into the template.
    expect(noteCalls.some((m) => m.includes(state.playbook_run_id))).toBe(true);
  });

  it("E2E-10 — apply + config valide + Réutiliser → config inchangée, composes + state, exit 0", async () => {
    await mkdir(arcDir, { recursive: true });
    const yaml = yamlStringify(validConfig);
    await writeFile(configFile, yaml, "utf8");
    programAnsibleOk();
    promptQueue.push("reuse");

    const r = await runSetupCli(["--apply"]);
    expect(r.exitCode).toBe(0);

    const after = await readFile(configFile, "utf8");
    expect(after).toBe(yaml); // byte-identical, no rewrite.

    const composeDir = join(arcDir, "compose");
    const composes = (await readdir(composeDir)).filter((f) => f.endsWith(".yml")).sort();
    expect(composes).toEqual([...COMPOSE_FILES].sort());

    await readFile(join(arcDir, "state.json"), "utf8"); // throws if missing.
    expect(noteCalls.some((m) => m.includes(APPLY_SUCCESS_TEMPLATE.split("\n")[0] ?? ""))).toBe(
      true,
    );
  });

  it("E2E-11 — apply sans Ansible installé → exit 2, message littéral, config écrite, no composes/state", async () => {
    programAnsibleAbsent();
    promptQueue.push(fresh.project, fresh.domain, fresh.email, fresh.dnsZone, fresh.dnsToken);

    const r = await runSetupCli(["--apply"]);
    expect(r.exitCode).toBe(2);

    // Config IS written (config phase happens before Ansible detection — no data loss).
    const written = await readFile(configFile, "utf8");
    expect(written).toContain(`project: ${fresh.project}`);

    // No compose dir, no state.json.
    const arcEntries = await readdir(arcDir);
    expect(arcEntries.includes("compose")).toBe(false);
    expect(arcEntries.includes("state.json")).toBe(false);

    // Exact ANSIBLE_NOT_INSTALLED_MESSAGE surfaced via clack cancel().
    const ansibleMsgShown = cancelCalls.some((m) => m === ANSIBLE_NOT_INSTALLED_MESSAGE);
    expect(ansibleMsgShown).toBe(true);

    // No stack trace leaked through stderr (persona-B contract).
    expect(r.stderr).not.toContain("at ");
    expect(r.stderr).not.toContain("Error:");
  });
});
