import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { CloudflareClient } from "./client.js";
import {
  CloudflareCredentialsMissingError,
  loadCloudflareCredentials,
  resolveZoneId,
} from "./credentials.js";

function writeTempEnv(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "arc-cf-creds-"));
  const path = join(dir, "cloudflare.env");
  writeFileSync(path, content, { mode: 0o600 });
  return path;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadCloudflareCredentials", () => {
  it("parses KEY=VALUE lines and returns typed credentials", () => {
    const path = writeTempEnv(
      [
        "# managed",
        "CLOUDFLARE_API_TOKEN=tok-abc",
        "CLOUDFLARE_ZONE_ID=zone-xyz",
        "",
        "CLOUDFLARE_API_BASE_URL=https://example.test/v4",
      ].join("\n"),
    );
    const creds = loadCloudflareCredentials(path);
    expect(creds.apiToken).toBe("tok-abc");
    expect(creds.zoneId).toBe("zone-xyz");
    expect(creds.baseUrl).toBe("https://example.test/v4");
  });

  it("throws CloudflareCredentialsMissingError when file missing", () => {
    expect(() => loadCloudflareCredentials("/nonexistent/cloudflare.env")).toThrow(
      CloudflareCredentialsMissingError,
    );
  });

  it("throws CloudflareCredentialsMissingError when token absent", () => {
    const path = writeTempEnv("CLOUDFLARE_ZONE_ID=zone-only\n");
    expect(() => loadCloudflareCredentials(path)).toThrow(CloudflareCredentialsMissingError);
  });
});

describe("resolveZoneId", () => {
  it("returns override flag value first (highest priority)", async () => {
    const client = new CloudflareClient({ apiToken: "t" });
    const id = await resolveZoneId({
      client,
      recordName: "foo.example.com",
      credentials: { apiToken: "t", zoneId: "from-env", baseUrl: undefined },
      override: "from-flag",
    });
    expect(id).toBe("from-flag");
  });

  it("auto-discovers via last-2-labels heuristic with strict name match", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          errors: [],
          messages: [],
          result: [
            { id: "wrong-fuzzy", name: "example.com.different.tld", status: "active" },
            { id: "auto-zone", name: "example.com", status: "active" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = new CloudflareClient({ apiToken: "t" });
    const id = await resolveZoneId({
      client,
      recordName: "foo.bar.example.com",
      credentials: { apiToken: "t", zoneId: undefined, baseUrl: undefined },
    });
    expect(id).toBe("auto-zone");
  });
});
