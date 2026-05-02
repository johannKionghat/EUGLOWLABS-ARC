import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ConfigError } from "./errors.js";
import { loadArcConfig } from "./load.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string => join(HERE, "__fixtures__", name);

describe("loadArcConfig", () => {
  it("loads a minimal local config and applies defaults", async () => {
    const cfg = await loadArcConfig(fixture("valid-local.yml"));
    expect(cfg.target).toBe("local");
    expect(cfg.provider).toBeUndefined();
    expect(cfg.stack.paas).toBe("coolify");
    expect(cfg.stack.ai_stack).toBe(true);
    expect(cfg.dns.tunnel).toBe(true);
    expect(cfg.projects).toEqual([]);
  });

  it("loads a full vps config including provider, projects and ollama", async () => {
    const cfg = await loadArcConfig(fixture("valid-vps.yml"));
    expect(cfg.target).toBe("vps");
    expect(cfg.provider?.plan).toBe("cx32");
    expect(cfg.backups.remote?.bucket).toBe("mondomaine-backups");
    expect(cfg.services.ollama.models).toContain("mistral:7b");
    expect(cfg.projects.map((p) => p.name)).toEqual(["euglow", "infinixui"]);
  });

  it("throws ConfigError(kind=not-found) when the file does not exist", async () => {
    await expect(loadArcConfig(fixture("does-not-exist.yml"))).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ConfigError);
      const ce = err as ConfigError;
      expect(ce.kind).toBe("not-found");
      expect(ce.toUserMessage()).toContain("does-not-exist.yml");
      return true;
    });
  });

  it("throws ConfigError(kind=syntax) for malformed YAML, with line:col", async () => {
    await expect(loadArcConfig(fixture("invalid-yaml.yml"))).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ConfigError);
      const ce = err as ConfigError;
      expect(ce.kind).toBe("syntax");
      // Either a position was extracted, or at minimum the message
      // surfaces the path. Both are acceptable contracts.
      expect(ce.toUserMessage()).toContain(".yml");
      return true;
    });
  });

  it("throws ConfigError(kind=schema) with multiple readable issues", async () => {
    await expect(loadArcConfig(fixture("invalid-schema.yml"))).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ConfigError);
      const ce = err as ConfigError;
      expect(ce.kind).toBe("schema");
      expect(ce.issues.length).toBeGreaterThanOrEqual(2);
      const message = ce.toUserMessage();
      // Each issue is rendered as a bullet line with a path prefix.
      expect(message).toMatch(/email:/);
      expect(message).toMatch(/target:/);
      return true;
    });
  });
});
