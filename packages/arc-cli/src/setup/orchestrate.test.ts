import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { DetectionResult } from "./idempotence.js";

// ---- mock: @clack/prompts -------------------------------------------------
//
// We script the prompt sequence by pushing values onto `promptQueue`
// before calling runSetup(). Each call to text/select/etc. shifts the
// next value from the queue. If the queue is empty, the test fails
// loudly so we never silently default.

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

// ---- mock: ./idempotence.js ----------------------------------------------

const detectionMock = vi.fn<() => Promise<DetectionResult>>();

vi.mock("./idempotence.js", () => ({
  detectExistingConfig: () => detectionMock(),
}));

// ---- mock: ./apply.js (sub-task 5) ---------------------------------------
//
// We mock applyStack so orchestrate tests stay focused on the wiring
// (which path leads to apply, with which options) ; applyStack itself
// is tested in isolation in apply.test.ts (sub-task 4).

const applyStackMock =
  vi.fn<(cfg: unknown, adapter: unknown, opts?: { force?: boolean }) => Promise<number>>();

vi.mock("./apply.js", () => ({
  applyStack: (cfg: unknown, adapter: unknown, opts?: { force?: boolean }) =>
    applyStackMock(cfg, adapter, opts),
}));

// ---- mock: ./state.js ----------------------------------------------------
//
// orchestrate reads state.json after applyStack returns 0 to surface
// the playbook_run_id in the success message. We feed a stub state.

const loadStateFileMock = vi.fn();

vi.mock("./state.js", () => ({
  loadStateFile: () => loadStateFileMock(),
  STATE_SCHEMA_VERSION: 1,
}));

// ---- subject under test (imported AFTER mocks) ----------------------------

import {
  APPLY_SUCCESS_TEMPLATE,
  EXIT_CANCELLED,
  EXIT_ENV_ERROR,
  EXIT_OK,
  FORCE_WITHOUT_APPLY_NOTICE,
  runSetup,
} from "./orchestrate.js";

// ---- shared fixtures ------------------------------------------------------

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

const promptDraft = {
  project: "fresh-stack",
  domain: "mondomaine.dev",
  email: "fresh@mondomaine.dev",
  dnsZone: "mondomaine.dev",
  dnsToken: "cf-token-fresh",
};

describe("runSetup", () => {
  let tmpHome: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    originalHome = process.env.HOME;
    tmpHome = await mkdtemp(join(tmpdir(), "arc-orchestrate-"));
    process.env.HOME = tmpHome;
    promptQueue.length = 0;
    detectionMock.mockReset();
    applyStackMock.mockReset();
    loadStateFileMock.mockReset();
  });

  afterEach(async () => {
    await rm(tmpHome, { recursive: true, force: true });
    if (originalHome === undefined) {
      // biome-ignore lint/performance/noDelete: assigning undefined coerces to "undefined" string in process.env, only delete unsets the variable.
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  });

  it("absent → runs prompts, writes ~/.arc/arc.config.yml, returns EXIT_OK", async () => {
    detectionMock.mockResolvedValue({ status: "absent" });
    promptQueue.push(
      promptDraft.project,
      promptDraft.domain,
      promptDraft.email,
      promptDraft.dnsZone,
      promptDraft.dnsToken,
    );

    const code = await runSetup();
    expect(code).toBe(EXIT_OK);

    const written = await readFile(join(tmpHome, ".arc", "arc.config.yml"), "utf8");
    expect(written).toContain("project: fresh-stack");
    expect(written).toContain("api_token: cf-token-fresh");
  });

  it("valid + 'reuse' → returns EXIT_OK without writing", async () => {
    detectionMock.mockResolvedValue({ status: "valid", config: validConfig });
    promptQueue.push("reuse");

    const code = await runSetup();
    expect(code).toBe(EXIT_OK);

    // No file should have been written.
    await expect(stat(join(tmpHome, ".arc", "arc.config.yml"))).rejects.toThrow();
  });

  it("valid + 'cancel' → returns EXIT_CANCELLED without writing", async () => {
    detectionMock.mockResolvedValue({ status: "valid", config: validConfig });
    promptQueue.push("cancel");

    const code = await runSetup();
    expect(code).toBe(EXIT_CANCELLED);
  });

  it("valid + 'rewrite' → re-prompts with defaults and overwrites", async () => {
    // Pre-create the existing config so the overwrite is real.
    const arcDir = join(tmpHome, ".arc");
    await mkdir(arcDir, { recursive: true });
    detectionMock.mockResolvedValue({ status: "valid", config: validConfig });
    promptQueue.push(
      "rewrite", // select
      "rewritten-stack", // project text
      validConfig.domain, // domain text
      "new-admin@mondomaine.dev", // email text
      validConfig.dns.zone, // dnsZone text
      "cf-token-rewritten", // dns api_token text (sensitive)
    );

    const code = await runSetup();
    expect(code).toBe(EXIT_OK);

    const written = await readFile(join(arcDir, "arc.config.yml"), "utf8");
    expect(written).toContain("project: rewritten-stack");
    expect(written).toContain("api_token: cf-token-rewritten");
  });

  it("corrupted + 'cancel' → returns EXIT_CANCELLED without backup", async () => {
    detectionMock.mockResolvedValue({
      status: "corrupted",
      raw: "not yaml",
      error: new Error("parse failure"),
    });
    promptQueue.push("cancel");

    const code = await runSetup();
    expect(code).toBe(EXIT_CANCELLED);
  });

  it("corrupted + 'backup' → renames to .broken-<ts>, prompts, writes new", async () => {
    const arcDir = join(tmpHome, ".arc");
    await mkdir(arcDir, { recursive: true });
    const configFile = join(arcDir, "arc.config.yml");
    await (await import("node:fs/promises")).writeFile(configFile, "garbage:::\n", "utf8");

    detectionMock.mockResolvedValue({
      status: "corrupted",
      raw: "garbage:::\n",
      error: new Error("parse failure"),
    });
    promptQueue.push(
      "backup", // select
      promptDraft.project,
      promptDraft.domain,
      promptDraft.email,
      promptDraft.dnsZone,
      promptDraft.dnsToken,
    );

    const code = await runSetup();
    expect(code).toBe(EXIT_OK);

    const written = await readFile(configFile, "utf8");
    expect(written).toContain("project: fresh-stack");

    const dirEntries = await (await import("node:fs/promises")).readdir(arcDir);
    expect(dirEntries.some((e) => e.startsWith("arc.config.yml.broken-"))).toBe(true);
  });

  it("schema_mismatch + 'complete' → re-prompts with defaults and writes", async () => {
    const arcDir = join(tmpHome, ".arc");
    await mkdir(arcDir, { recursive: true });
    const fakeError = new z.ZodError([{ code: "custom", path: ["email"], message: "Required" }]);
    detectionMock.mockResolvedValue({
      status: "schema_mismatch",
      raw: { project: "partial", domain: "mondomaine.dev" },
      errors: fakeError,
    });
    promptQueue.push(
      "complete", // select
      "partial", // project (default)
      "mondomaine.dev", // domain (default)
      "completed@mondomaine.dev", // email (was missing, user provides)
      "mondomaine.dev", // dns zone
      "cf-token-completed", // dns api_token
    );

    const code = await runSetup();
    expect(code).toBe(EXIT_OK);

    const written = await readFile(join(arcDir, "arc.config.yml"), "utf8");
    expect(written).toContain("project: partial");
    expect(written).toContain("email: completed@mondomaine.dev");
  });

  it("permission_denied → returns EXIT_ENV_ERROR without prompts", async () => {
    detectionMock.mockResolvedValue({
      status: "permission_denied",
      path: "/some/path",
      error: new Error("EACCES"),
    });

    const code = await runSetup();
    expect(code).toBe(EXIT_ENV_ERROR);
  });

  it("user_dir_invalid → returns EXIT_ENV_ERROR without prompts", async () => {
    detectionMock.mockResolvedValue({
      status: "user_dir_invalid",
      path: "/some/path",
      reason: "exists but is not a directory",
    });

    const code = await runSetup();
    expect(code).toBe(EXIT_ENV_ERROR);
  });

  // -------------------------------------------------------------------------
  // INSTALL-002 sub-task 5 — --apply branching
  // -------------------------------------------------------------------------

  function programApplyOk(): void {
    applyStackMock.mockResolvedValue(EXIT_OK);
    loadStateFileMock.mockResolvedValue({
      status: "ok",
      state: {
        schema_version: 1,
        last_apply: "2026-05-04T14:32:18.000Z",
        compose_files: [
          "docker-compose.agents.yml",
          "docker-compose.prod.yml",
          "docker-compose.sandbox.yml",
        ],
        ansible_version: "2.16.3",
        playbook_run_id: "deadbeef-1234-4567-89ab-cdef01234567",
      },
    });
  }

  it("apply + absent → prompts, writes config, applyStack called once, EXIT_OK", async () => {
    detectionMock
      .mockResolvedValueOnce({ status: "absent" })
      // Second call after the write : finalizeSuccess re-detects to get
      // a validated ArcConfig before forwarding to applyStack.
      .mockResolvedValueOnce({ status: "valid", config: validConfig });
    programApplyOk();
    promptQueue.push(
      promptDraft.project,
      promptDraft.domain,
      promptDraft.email,
      promptDraft.dnsZone,
      promptDraft.dnsToken,
    );

    const code = await runSetup({ apply: true });
    expect(code).toBe(EXIT_OK);
    expect(applyStackMock).toHaveBeenCalledTimes(1);
    expect(applyStackMock.mock.calls[0]?.[2]).toEqual({ force: false });
  });

  it("apply + valid + 'reuse' → applyStack called directly without re-prompts", async () => {
    detectionMock.mockResolvedValue({ status: "valid", config: validConfig });
    programApplyOk();
    promptQueue.push("reuse");

    const code = await runSetup({ apply: true });
    expect(code).toBe(EXIT_OK);
    expect(applyStackMock).toHaveBeenCalledTimes(1);
    expect(applyStackMock.mock.calls[0]?.[0]).toEqual(validConfig);
    // No re-prompt entries consumed beyond "reuse".
    expect(promptQueue.length).toBe(0);
  });

  it("apply + valid + 'cancel' → applyStack NOT called, EXIT_CANCELLED", async () => {
    detectionMock.mockResolvedValue({ status: "valid", config: validConfig });
    promptQueue.push("cancel");

    const code = await runSetup({ apply: true });
    expect(code).toBe(EXIT_CANCELLED);
    expect(applyStackMock).not.toHaveBeenCalled();
  });

  it("apply + force → applyStack receives { force: true }, no Réutiliser menu", async () => {
    detectionMock
      // First detection sees the existing valid config ; --force skips the menu.
      .mockResolvedValueOnce({ status: "valid", config: validConfig })
      // After the rewrite, finalizeSuccess re-detects to get the persisted shape.
      .mockResolvedValueOnce({ status: "valid", config: validConfig });
    programApplyOk();
    // --force triggers the rewrite branch → re-prompts queue.
    promptQueue.push(
      promptDraft.project,
      promptDraft.domain,
      promptDraft.email,
      promptDraft.dnsZone,
      promptDraft.dnsToken,
    );

    const code = await runSetup({ apply: true, force: true });
    expect(code).toBe(EXIT_OK);
    expect(applyStackMock).toHaveBeenCalledTimes(1);
    expect(applyStackMock.mock.calls[0]?.[2]).toEqual({ force: true });
  });

  it("force without apply → emits FORCE_WITHOUT_APPLY_NOTICE but still honours INSTALL-001 force", async () => {
    const { note } = await import("@clack/prompts");
    const noteSpy = vi.mocked(note);
    noteSpy.mockClear();

    detectionMock.mockResolvedValue({ status: "valid", config: validConfig });
    promptQueue.push(
      promptDraft.project,
      promptDraft.domain,
      promptDraft.email,
      promptDraft.dnsZone,
      promptDraft.dnsToken,
    );

    const code = await runSetup({ force: true });
    expect(code).toBe(EXIT_OK);
    expect(applyStackMock).not.toHaveBeenCalled();
    const noticeShown = noteSpy.mock.calls.some(
      (call) => typeof call[0] === "string" && call[0].includes(FORCE_WITHOUT_APPLY_NOTICE),
    );
    expect(noticeShown).toBe(true);
  });

  it("APPLY_SUCCESS_TEMPLATE — literal contract (Décision 3)", () => {
    expect(APPLY_SUCCESS_TEMPLATE).toContain("✓ Stack ARC appliquée avec succès.");
    expect(APPLY_SUCCESS_TEMPLATE).toContain("Composes générés dans ~/.arc/compose/.");
    expect(APPLY_SUCCESS_TEMPLATE).toContain("Application Ansible : <playbook_run_id>.");
    expect(APPLY_SUCCESS_TEMPLATE).toContain("Vérifier l'état : arc status");
    expect(APPLY_SUCCESS_TEMPLATE).toContain("Voir les logs : arc logs");
    expect(APPLY_SUCCESS_TEMPLATE).toContain("Migrer un projet : voir docs/migration-guide.md");
  });
});
