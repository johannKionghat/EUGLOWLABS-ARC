import { afterEach, describe, expect, it, vi } from "vitest";

import { CloudflareClient } from "./client";
import {
  CloudflareAuthError,
  CloudflareNotFoundError,
  CloudflareRateLimitError,
  CloudflareValidationError,
} from "./errors";

const TOKEN = "test-token";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOk(jsonBody: unknown, status = 200): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(jsonBody), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("CloudflareClient", () => {
  it("listZones returns parsed array on success", async () => {
    mockFetchOk({
      success: true,
      errors: [],
      messages: [],
      result: [{ id: "zone-1", name: "example.com", status: "active" }],
    });
    const client = new CloudflareClient({ apiToken: TOKEN });
    const zones = await client.listZones("example.com");
    expect(zones).toHaveLength(1);
    expect(zones[0]?.id).toBe("zone-1");
    expect(zones[0]?.name).toBe("example.com");
  });

  it("throws CloudflareAuthError on 401", async () => {
    mockFetchOk(
      {
        success: false,
        errors: [{ code: 10000, message: "Authentication error" }],
        messages: [],
        result: null,
      },
      401,
    );
    const client = new CloudflareClient({ apiToken: TOKEN });
    await expect(client.listZones()).rejects.toBeInstanceOf(CloudflareAuthError);
  });

  it("throws CloudflareRateLimitError on 429", async () => {
    mockFetchOk(
      {
        success: false,
        errors: [{ code: 10013, message: "Rate limited" }],
        messages: [],
        result: null,
      },
      429,
    );
    const client = new CloudflareClient({ apiToken: TOKEN });
    await expect(client.listZones()).rejects.toBeInstanceOf(CloudflareRateLimitError);
  });

  it("throws CloudflareNotFoundError on 404", async () => {
    mockFetchOk(
      {
        success: false,
        errors: [{ code: 7003, message: "Zone not found" }],
        messages: [],
        result: null,
      },
      404,
    );
    const client = new CloudflareClient({ apiToken: TOKEN });
    await expect(client.listDnsRecords("nonexistent")).rejects.toBeInstanceOf(
      CloudflareNotFoundError,
    );
  });

  it("throws CloudflareValidationError on 400 (invalid record)", async () => {
    mockFetchOk(
      {
        success: false,
        errors: [{ code: 1004, message: "DNS record content invalid" }],
        messages: [],
        result: null,
      },
      400,
    );
    const client = new CloudflareClient({ apiToken: TOKEN });
    await expect(
      client.createDnsRecord("zone-1", {
        type: "A",
        name: "test.example.com",
        content: "not-an-ip",
      }),
    ).rejects.toBeInstanceOf(CloudflareValidationError);
  });
});
