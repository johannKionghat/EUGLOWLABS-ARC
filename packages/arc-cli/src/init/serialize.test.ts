import { arcConfigSchema } from "@euglowlabs/arc-shared";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import { serializeArcConfig } from "./serialize.js";

const fixedDate = new Date("2026-05-02T12:00:00Z");

describe("serializeArcConfig", () => {
  it("serializes a minimal local config and round-trips through the schema", () => {
    const cfg = {
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
    const yaml = serializeArcConfig(cfg, fixedDate);
    expect(yaml.startsWith("# arc.config.yml")).toBe(true);
    expect(yaml).toContain("2026-05-02");
    const reparsed = arcConfigSchema.safeParse(parseYaml(yaml));
    expect(reparsed.success).toBe(true);
  });

  it("serializes a vps config with provider and ollama models", () => {
    const cfg = {
      project: "johann-stack",
      target: "vps" as const,
      domain: "mondomaine.dev",
      email: "johann@mondomaine.dev",
      provider: {
        name: "hetzner" as const,
        plan: "cx32",
        location: "fsn1",
        ssh_key: "~/.ssh/id_ed25519.pub",
      },
      dns: {
        provider: "cloudflare" as const,
        zone: "mondomaine.dev",
        api_token: "cf-token",
      },
      services: { ollama: { models: ["mistral:7b"] } },
    };
    const yaml = serializeArcConfig(cfg, fixedDate);
    expect(yaml).toContain("target: vps");
    expect(yaml).toContain("hetzner");
    expect(yaml).toContain("mistral:7b");
    const reparsed = arcConfigSchema.safeParse(parseYaml(yaml));
    expect(reparsed.success).toBe(true);
  });
});
