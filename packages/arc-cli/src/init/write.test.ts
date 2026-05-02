import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadArcConfig } from "../config/load.js";
import { writeArcConfig } from "./write.js";

const sampleConfig = {
  project: "johann-stack",
  target: "local" as const,
  domain: "mondomaine.dev",
  email: "johann@mondomaine.dev",
  dns: {
    provider: "cloudflare" as const,
    zone: "mondomaine.dev",
    api_token: "cf-token",
  },
};

describe("writeArcConfig", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "arc-init-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes a YAML file that round-trips through loadArcConfig", async () => {
    const path = join(dir, "arc.config.yml");
    await writeArcConfig(path, sampleConfig);
    const cfg = await loadArcConfig(path);
    expect(cfg.target).toBe("local");
    expect(cfg.project).toBe("johann-stack");
  });

  it("refuses to overwrite an existing file without --force", async () => {
    const path = join(dir, "arc.config.yml");
    await writeArcConfig(path, sampleConfig);
    await expect(writeArcConfig(path, sampleConfig)).rejects.toThrow(/already exists/);
  });

  it("overwrites when force=true", async () => {
    const path = join(dir, "arc.config.yml");
    await writeArcConfig(path, sampleConfig);
    const replaced = { ...sampleConfig, project: "renamed-stack" };
    await writeArcConfig(path, replaced, { force: true });
    const yaml = await readFile(path, "utf8");
    expect(yaml).toContain("renamed-stack");
  });
});
