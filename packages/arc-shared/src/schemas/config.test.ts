import { describe, expect, it } from "vitest";

import { arcConfigSchema } from "./config.js";

const minimal = {
  project: "johann-stack",
  domain: "mondomaine.dev",
  email: "johann@mondomaine.dev",
  dns: {
    provider: "cloudflare",
    zone: "mondomaine.dev",
    api_token: "cf-token",
  },
};

const fullExplicit = {
  ...minimal,
  agent: { bind: "0.0.0.0", port: 9000 },
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
  it("accepts a minimal config and applies all defaults", () => {
    const parsed = arcConfigSchema.parse(minimal);
    expect(parsed.project).toBe("johann-stack");
    expect(parsed.agent.bind).toBe("127.0.0.1");
    expect(parsed.agent.port).toBe(9999);
    expect(parsed.stack.paas).toBe("coolify");
    expect(parsed.stack.ai_stack).toBe(true);
    expect(parsed.backups.schedule).toBe("0 2 * * *");
    expect(parsed.services.ollama.models).toEqual([]);
    expect(parsed.projects).toEqual([]);
  });

  it("accepts a fully explicit config with all sections", () => {
    const parsed = arcConfigSchema.parse(fullExplicit);
    expect(parsed.agent.bind).toBe("0.0.0.0");
    expect(parsed.agent.port).toBe(9000);
    expect(parsed.backups.remote?.bucket).toBe("mondomaine-backups");
    expect(parsed.services.ollama.models).toContain("mistral:7b");
    expect(parsed.projects).toHaveLength(2);
  });

  it("rejects an invalid email", () => {
    const result = arcConfigSchema.safeParse({
      ...minimal,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "email")).toBe(true);
    }
  });

  it("rejects an invalid project slug", () => {
    const result = arcConfigSchema.safeParse({
      ...minimal,
      project: "BadName",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "project")).toBe(true);
    }
  });

  it("rejects duplicate project subdomains", () => {
    const result = arcConfigSchema.safeParse({
      ...minimal,
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
      ...minimal,
      unknownField: "boom",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range agent.port", () => {
    const result = arcConfigSchema.safeParse({
      ...minimal,
      agent: { bind: "127.0.0.1", port: 70000 },
    });
    expect(result.success).toBe(false);
  });
});
