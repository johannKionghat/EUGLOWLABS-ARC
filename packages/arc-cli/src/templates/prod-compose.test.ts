import { type ArcConfig, arcConfigSchema } from "@euglowlabs/arc-shared";
import { describe, expect, it } from "vitest";

import { generateProdCompose } from "./prod-compose.js";

function sampleConfig(): ArcConfig {
  return arcConfigSchema.parse({
    project: "johann-stack",
    domain: "mondomaine.dev",
    email: "johann@mondomaine.dev",
    dns: {
      provider: "cloudflare",
      zone: "mondomaine.dev",
      api_token: "cf-token-xyz",
    },
  });
}

describe("generateProdCompose", () => {
  it("emits a prod_net network and an uptime-kuma service", () => {
    const out = generateProdCompose(sampleConfig());
    expect(out).toContain("networks:");
    expect(out).toContain("prod_net:");
    expect(out).toContain("uptime-kuma:");
    expect(out).toContain("louislam/uptime-kuma:1");
    expect(out).toContain("arc_uptime_kuma_data");
  });

  it("injects the user domain into the Traefik host rule", () => {
    const out = generateProdCompose(sampleConfig());
    expect(out).toContain("Host(`status.mondomaine.dev`)");
    expect(out).toContain("traefik.http.services.uptime-kuma.loadbalancer.server.port=3001");
  });

  it("contains no unresolved eta placeholders", () => {
    const out = generateProdCompose(sampleConfig());
    expect(out).not.toMatch(/<%[\s\S]*?%>/);
  });
});
