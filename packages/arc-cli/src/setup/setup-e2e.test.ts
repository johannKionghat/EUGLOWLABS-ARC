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

function nextPrompt(label: string): unknown {
  if (promptQueue.length === 0) {
    throw new Error(`prompt queue empty when ${label} was called`);
  }
  return promptQueue.shift();
}

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  note: vi.fn(),
  isCancel: (v: unknown) => v === Symbol.for("clack.cancel"),
  text: vi.fn(async () => nextPrompt("text")),
  password: vi.fn(async () => nextPrompt("password")),
  select: vi.fn(async () => nextPrompt("select")),
  confirm: vi.fn(async () => nextPrompt("confirm")),
}));

// Subject under test imported AFTER mock declarations.
import { runFromArgs } from "../cli.js";

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

async function runSetupCli(): Promise<RunResult> {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
  stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
  const exitCode = await runFromArgs(["setup"], { stdout, stderr });
  return {
    exitCode,
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
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
});
