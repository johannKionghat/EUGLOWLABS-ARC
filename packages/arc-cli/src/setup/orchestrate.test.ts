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

// ---- subject under test (imported AFTER mocks) ----------------------------

import { EXIT_CANCELLED, EXIT_ENV_ERROR, EXIT_OK, runSetup } from "./orchestrate.js";

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
});
