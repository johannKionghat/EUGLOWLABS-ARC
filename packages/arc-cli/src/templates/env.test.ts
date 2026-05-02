import { type ArcConfig, arcConfigSchema } from "@euglowlabs/arc-shared";
import { describe, expect, it } from "vitest";

import { generateEnvFile } from "./env.js";

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

describe("generateEnvFile", () => {
  it("reflects domain, email and CF token from the config", () => {
    const out = generateEnvFile(sampleConfig());
    expect(out).toContain("BASE_DOMAIN=mondomaine.dev");
    expect(out).toContain("ADMIN_EMAIL=johann@mondomaine.dev");
    expect(out).toContain("CF_API_TOKEN=cf-token-xyz");
  });

  it("emits explicit __REPLACE_ME__ placeholders for runtime secrets", () => {
    const out = generateEnvFile(sampleConfig());
    expect(out).toContain("JWT_SECRET=__REPLACE_ME__");
    expect(out).toContain("POSTGRES_PASSWORD=__REPLACE_ME__");
  });

  it("contains no unresolved eta placeholders", () => {
    const out = generateEnvFile(sampleConfig());
    expect(out).not.toMatch(/<%[\s\S]*?%>/);
  });
});
