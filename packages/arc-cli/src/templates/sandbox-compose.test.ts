import { type ArcConfig, arcConfigSchema } from "@euglowlabs/arc-shared";
import { describe, expect, it } from "vitest";

import { generateSandboxCompose } from "./sandbox-compose.js";

function sampleConfig(): ArcConfig {
  return arcConfigSchema.parse({
    project: "johann-stack",
    target: "local",
    domain: "mondomaine.dev",
    email: "johann@mondomaine.dev",
    dns: {
      provider: "cloudflare",
      zone: "mondomaine.dev",
      api_token: "cf-token-xyz",
    },
  });
}

describe("generateSandboxCompose", () => {
  it("declares sandbox_net with internal: true (security boundary, ADR-0008)", () => {
    const out = generateSandboxCompose(sampleConfig());
    expect(out).toContain("sandbox_net:");
    // The combination "internal: true" is the security guarantee.
    expect(out).toMatch(/internal:\s*true/);
  });

  it("hardens code-executor with all five required constraints", () => {
    const out = generateSandboxCompose(sampleConfig());
    expect(out).toMatch(/read_only:\s*true/);
    expect(out).toContain("cap_drop:");
    expect(out).toContain("- ALL");
    expect(out).toContain("no-new-privileges:true");
    expect(out).toMatch(/mem_limit:\s*512m/);
    expect(out).toMatch(/cpus:\s*0\.5/);
  });

  it("includes a code-server with a named workspace volume and password env", () => {
    const out = generateSandboxCompose(sampleConfig());
    expect(out).toContain("code-server:");
    expect(out).toContain("codercom/code-server");
    expect(out).toContain("arc_sandbox_workspace");
    expect(out).toContain("PASSWORD: ${CODE_SERVER_PASSWORD}");
  });

  it("contains no unresolved eta placeholders", () => {
    const out = generateSandboxCompose(sampleConfig());
    expect(out).not.toMatch(/<%[\s\S]*?%>/);
  });
});
