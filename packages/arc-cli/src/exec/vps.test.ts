import { describe, expect, it } from "vitest";

import { VPSAdapter } from "./vps.js";

describe("VPSAdapter", () => {
  it("describe() reflects the configured host", () => {
    const adapter = new VPSAdapter({
      host: "1.2.3.4",
      username: "root",
      privateKeyPath: "/tmp/key",
    });
    expect(adapter.describe()).toBe("vps:1.2.3.4");
  });

  it("disconnect() is safe to call before any connection was made", async () => {
    const adapter = new VPSAdapter({
      host: "1.2.3.4",
      username: "root",
      privateKey: "PRIVATE",
    });
    await expect(adapter.disconnect()).resolves.toBeUndefined();
  });
});
