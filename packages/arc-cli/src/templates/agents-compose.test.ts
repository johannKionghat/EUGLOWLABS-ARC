import { type ArcConfig, arcConfigSchema } from "@euglowlabs/arc-shared";
import { describe, expect, it } from "vitest";

import { generateAgentsCompose } from "./agents-compose.js";

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

describe("generateAgentsCompose", () => {
  it("declares both openclaw and deepagents services with their upstream images", () => {
    const out = generateAgentsCompose(sampleConfig());
    expect(out).toContain("openclaw:");
    expect(out).toContain("ghcr.io/openclaw/openclaw:latest");
    expect(out).toContain("deepagents:");
    expect(out).toContain("deepagents/deepagents:latest");
  });

  it("attaches deepagents to BOTH ai_net and sandbox_net (junction point, ADR-0008)", () => {
    const out = generateAgentsCompose(sampleConfig());
    // deepagents block must mention both networks; openclaw only ai_net.
    const deepagentsBlock = out.slice(out.indexOf("deepagents:"));
    expect(deepagentsBlock).toContain("- ai_net");
    expect(deepagentsBlock).toContain("- sandbox_net");
    expect(deepagentsBlock).toContain("depends_on:");
    expect(deepagentsBlock).toContain("- openclaw");
  });

  it("emits Traefik labels using the configured domain for each service", () => {
    const out = generateAgentsCompose(sampleConfig());
    expect(out).toContain("Host(`openclaw.mondomaine.dev`)");
    expect(out).toContain("Host(`agents.mondomaine.dev`)");
    expect(out).toContain("traefik.http.services.openclaw.loadbalancer.server.port=3100");
    expect(out).toContain("traefik.http.services.agents.loadbalancer.server.port=3200");
  });

  it("contains no unresolved eta placeholders", () => {
    const out = generateAgentsCompose(sampleConfig());
    expect(out).not.toMatch(/<%[\s\S]*?%>/);
  });
});
