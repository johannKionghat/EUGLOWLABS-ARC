import { describe, expect, it } from "vitest";

import { arcConfigSchema } from "./config.js";

const minimalLocal = {
  project: "johann-stack",
  target: "local",
  domain: "mondomaine.dev",
  email: "johann@mondomaine.dev",
  dns: {
    provider: "cloudflare",
    zone: "mondomaine.dev",
    api_token: "cf-token",
  },
};

const fullVps = {
  ...minimalLocal,
  target: "vps",
  provider: {
    name: "hetzner",
    plan: "cx32",
    location: "fsn1",
    ssh_key: "~/.ssh/id_ed25519.pub",
  },
  dns: {
    provider: "cloudflare",
    zone: "mondomaine.dev",
    api_token: "cf-token",
    tunnel: false,
  },
  stack: {
    paas: "coolify",
    ai_stack: true,
    sandbox: true,
    monitoring: "uptime-kuma",
  },
  backups: {
    enabled: true,
    schedule: "0 2 * * *",
    retention_days: 7,
    remote: { provider: "r2", bucket: "mondomaine-backups" },
  },
  services: {
    ollama: { models: ["mistral:7b", "nomic-embed-text"] },
  },
  projects: [
    { name: "euglow", repo: "github.com/johann/euglow", subdomain: "euglow", branch: "main" },
    {
      name: "infinixui",
      repo: "github.com/johann/infinixui",
      subdomain: "infinixui",
      branch: "main",
    },
  ],
};

describe("arcConfigSchema", () => {
  it("accepts a minimal local config without provider", () => {
    const parsed = arcConfigSchema.parse(minimalLocal);
    expect(parsed.target).toBe("local");
    expect(parsed.provider).toBeUndefined();
  });

  it("accepts a full vps config with all sections", () => {
    const parsed = arcConfigSchema.parse(fullVps);
    expect(parsed.target).toBe("vps");
    expect(parsed.provider?.plan).toBe("cx32");
    expect(parsed.projects).toHaveLength(2);
  });

  it("applies defaults for paas, tunnel, branch and stack flags", () => {
    const parsed = arcConfigSchema.parse(minimalLocal);
    expect(parsed.dns.tunnel).toBe(false);
    expect(parsed.stack.paas).toBe("coolify");
    expect(parsed.stack.ai_stack).toBe(true);
    expect(parsed.backups.schedule).toBe("0 2 * * *");
    expect(parsed.services.ollama.models).toEqual([]);
    expect(parsed.projects).toEqual([]);
  });

  it("rejects an invalid email", () => {
    const result = arcConfigSchema.safeParse({
      ...minimalLocal,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "email")).toBe(true);
    }
  });

  it("rejects an unknown target value", () => {
    const result = arcConfigSchema.safeParse({ ...minimalLocal, target: "azure" });
    expect(result.success).toBe(false);
  });

  it("rejects target=vps without provider", () => {
    const result = arcConfigSchema.safeParse({ ...minimalLocal, target: "vps" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const onProvider = result.error.issues.some((issue) => issue.path[0] === "provider");
      expect(onProvider).toBe(true);
    }
  });

  it("rejects duplicate project subdomains", () => {
    const result = arcConfigSchema.safeParse({
      ...minimalLocal,
      projects: [
        { name: "euglow", repo: "r1", subdomain: "app" },
        { name: "infinixui", repo: "r2", subdomain: "app" },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const onProjects = result.error.issues.some((issue) => issue.path[0] === "projects");
      expect(onProjects).toBe(true);
    }
  });

  it("rejects unknown top-level keys (strict)", () => {
    const result = arcConfigSchema.safeParse({
      ...minimalLocal,
      unknownField: "boom",
    });
    expect(result.success).toBe(false);
  });
});
