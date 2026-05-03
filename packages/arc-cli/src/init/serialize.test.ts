import { arcConfigSchema } from "@euglowlabs/arc-shared";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import { serializeArcConfig } from "./serialize.js";

const fixedDate = new Date("2026-05-02T12:00:00Z");

describe("serializeArcConfig", () => {
  it("serializes a minimal config and round-trips through the schema", () => {
    const cfg = {
      project: "johann-stack",
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

  it("serializes a config with explicit agent + ollama models and round-trips", () => {
    const cfg = {
      project: "johann-stack",
      domain: "mondomaine.dev",
      email: "johann@mondomaine.dev",
      dns: {
        provider: "cloudflare" as const,
        zone: "mondomaine.dev",
        api_token: "cf-token",
      },
      agent: { bind: "0.0.0.0", port: 9000 },
      services: { ollama: { models: ["mistral:7b"] } },
    };
    const yaml = serializeArcConfig(cfg, fixedDate);
    expect(yaml).toContain("bind: 0.0.0.0");
    expect(yaml).toContain("port: 9000");
    expect(yaml).toContain("mistral:7b");
    const reparsed = arcConfigSchema.safeParse(parseYaml(yaml));
    expect(reparsed.success).toBe(true);
  });
});
