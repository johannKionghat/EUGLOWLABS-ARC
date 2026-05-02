import { type ArcConfig, arcConfigSchema } from "@euglowlabs/arc-shared";
import { describe, expect, it } from "vitest";

import { generateProdCompose } from "./prod-compose.js";

function configFor(target: "local" | "vps"): ArcConfig {
  const base = {
    project: "johann-stack",
    target,
    domain: "mondomaine.dev",
    email: "johann@mondomaine.dev",
    dns: {
      provider: "cloudflare" as const,
      zone: "mondomaine.dev",
      api_token: "cf-token-xyz",
    },
    ...(target === "vps"
      ? {
          provider: {
            name: "hetzner" as const,
            plan: "cx32",
            location: "fsn1",
            ssh_key: "~/.ssh/id_ed25519.pub",
          },
        }
      : {}),
  };
  return arcConfigSchema.parse(base);
}

describe("generateProdCompose", () => {
  it("emits a prod_net network and an uptime-kuma service for a local config", () => {
    const out = generateProdCompose(configFor("local"));
    expect(out).toContain("networks:");
    expect(out).toContain("prod_net:");
    expect(out).toContain("uptime-kuma:");
    expect(out).toContain("louislam/uptime-kuma:1");
    expect(out).toContain("arc_uptime_kuma_data");
  });

  it("injects the user domain into the Traefik host rule", () => {
    const out = generateProdCompose(configFor("vps"));
    expect(out).toContain("Host(`status.mondomaine.dev`)");
    expect(out).toContain("traefik.http.services.uptime-kuma.loadbalancer.server.port=3001");
  });

  it("contains no unresolved eta placeholders", () => {
    const out = generateProdCompose(configFor("local"));
    expect(out).not.toMatch(/<%[\s\S]*?%>/);
  });
});
