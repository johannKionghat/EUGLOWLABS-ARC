import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stringify as yamlStringify } from "yaml";

import { detectExistingConfig } from "./idempotence.js";

const validConfig = {
  project: "johann-stack",
  domain: "mondomaine.dev",
  email: "johann@mondomaine.dev",
  dns: {
    provider: "cloudflare" as const,
    zone: "mondomaine.dev",
    api_token: "cf-token",
  },
};

describe("detectExistingConfig", () => {
  let tmpHome: string;
  let arcDir: string;
  let configFile: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    originalHome = process.env.HOME;
    tmpHome = await mkdtemp(join(tmpdir(), "arc-idempotence-"));
    process.env.HOME = tmpHome;
    arcDir = join(tmpHome, ".arc");
    configFile = join(arcDir, "arc.config.yml");
  });

  afterEach(async () => {
    // Restore permissions before cleanup so rm can traverse.
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

  it("cas 1 — returns absent when ~/.arc/ does not exist", async () => {
    const result = await detectExistingConfig();
    expect(result).toEqual({ status: "absent" });
  });

  it("cas 1bis — returns absent when ~/.arc/ exists but config file does not", async () => {
    await mkdir(arcDir, { recursive: true });
    const result = await detectExistingConfig();
    expect(result).toEqual({ status: "absent" });
  });

  it("cas 2 — returns valid + parsed config when YAML is valid and matches schema", async () => {
    await mkdir(arcDir, { recursive: true });
    await writeFile(configFile, yamlStringify(validConfig), "utf8");
    const result = await detectExistingConfig();
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.config.project).toBe("johann-stack");
      expect(result.config.domain).toBe("mondomaine.dev");
    }
  });

  it("cas 3 — returns corrupted when YAML cannot be parsed", async () => {
    await mkdir(arcDir, { recursive: true });
    await writeFile(configFile, "project: [unclosed bracket\n  domain: oops", "utf8");
    const result = await detectExistingConfig();
    expect(result.status).toBe("corrupted");
    if (result.status === "corrupted") {
      expect(result.raw).toContain("unclosed bracket");
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it("cas 4 — returns schema_mismatch when YAML is valid but fields are missing", async () => {
    await mkdir(arcDir, { recursive: true });
    await writeFile(configFile, yamlStringify({ project: "x" }), "utf8");
    const result = await detectExistingConfig();
    expect(result.status).toBe("schema_mismatch");
    if (result.status === "schema_mismatch") {
      expect(result.errors.issues.length).toBeGreaterThan(0);
    }
  });

  it.skipIf(platform() === "win32")(
    "cas 5 — returns permission_denied when config file is unreadable",
    async () => {
      await mkdir(arcDir, { recursive: true });
      await writeFile(configFile, yamlStringify(validConfig), "utf8");
      await chmod(configFile, 0o000);
      const result = await detectExistingConfig();
      expect(result.status).toBe("permission_denied");
      if (result.status === "permission_denied") {
        expect(result.path).toBe(configFile);
      }
    },
  );

  it("cas 6 — returns user_dir_invalid when ~/.arc exists as a file instead of a directory", async () => {
    await writeFile(arcDir, "this should be a directory", "utf8");
    const result = await detectExistingConfig();
    expect(result.status).toBe("user_dir_invalid");
    if (result.status === "user_dir_invalid") {
      expect(result.path).toBe(arcDir);
      expect(result.reason).toContain("not a directory");
    }
  });
});
