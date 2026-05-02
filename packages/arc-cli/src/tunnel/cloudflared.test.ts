import { describe, expect, it } from "vitest";

import { MockAdapter } from "../exec/index.js";
import { renderCloudflaredConfig, setupTunnel } from "./cloudflared.js";

describe("renderCloudflaredConfig", () => {
  it("emits a wildcard ingress for the domain on the configured port", () => {
    const yaml = renderCloudflaredConfig({
      name: "arc",
      domain: "mondomaine.dev",
      localPort: 8080,
    });
    expect(yaml).toContain("tunnel: arc");
    expect(yaml).toContain('hostname: "*.mondomaine.dev"');
    expect(yaml).toContain("http://localhost:8080");
  });

  it("defaults to port 80", () => {
    const yaml = renderCloudflaredConfig({ name: "arc", domain: "example.com" });
    expect(yaml).toContain("http://localhost:80");
  });
});

describe("setupTunnel", () => {
  it("invokes create + dns route + run via the adapter", async () => {
    const adapter = new MockAdapter();
    await setupTunnel({
      adapter,
      name: "arc",
      domain: "mondomaine.dev",
    });
    const cmds = adapter.calls
      .filter((c) => c.method === "exec")
      .map((c) => (c as { method: "exec"; cmd: string }).cmd);
    expect(cmds.some((c) => c.startsWith("cloudflared tunnel create arc"))).toBe(true);
    expect(cmds.some((c) => c.startsWith("cloudflared tunnel route dns arc"))).toBe(true);
    expect(cmds.some((c) => c.includes("cloudflared tunnel --config"))).toBe(true);
  });
});
