import { afterEach, describe, expect, it, vi } from "vitest";

import { mockJson, run, tempCreds } from "./test-helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("arc dns add", () => {
  it("--dry-run prints intent without any fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await run([
      "dns",
      "add",
      "foo.example.com",
      "--type",
      "A",
      "--content",
      "1.2.3.4",
      "--dry-run",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[dry-run]");
    expect(result.stdout).toContain("A foo.example.com → 1.2.3.4");
    expect(result.stdout).toContain("comment='managed-by:arc'");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("creates a new record when no collision", async () => {
    const credsPath = tempCreds("CLOUDFLARE_API_TOKEN=tok\nCLOUDFLARE_ZONE_ID=zone-1\n");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockJson({ success: true, errors: [], messages: [], result: [] }))
      .mockResolvedValueOnce(
        mockJson({
          success: true,
          errors: [],
          messages: [],
          result: { id: "new-id", type: "A", name: "foo.example.com", content: "1.2.3.4", ttl: 1 },
        }),
      );

    const result = await run([
      "dns",
      "add",
      "foo.example.com",
      "--type",
      "A",
      "--content",
      "1.2.3.4",
      "--credentials",
      credsPath,
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Created A record foo.example.com → 1.2.3.4");
    expect(result.stdout).toContain("id: new-id");
    expect(result.stdout).toContain("comment: 'managed-by:arc'");
  });

  it("rejects collision without --force (multi-line error, no POST)", async () => {
    const credsPath = tempCreds("CLOUDFLARE_API_TOKEN=tok\nCLOUDFLARE_ZONE_ID=zone-1\n");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockJson({
        success: true,
        errors: [],
        messages: [],
        result: [{ id: "old-id", type: "A", name: "foo.example.com", content: "9.9.9.9", ttl: 1 }],
      }),
    );

    const result = await run([
      "dns",
      "add",
      "foo.example.com",
      "--type",
      "A",
      "--content",
      "1.2.3.4",
      "--credentials",
      credsPath,
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("already exists");
    expect(result.stderr).toContain("id: old-id");
    expect(result.stderr).toContain("--force");
    expect(result.stderr).toContain("arc dns remove");
    expect(result.stderr).toContain("arc dns list");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("--force replaces existing record (delete-then-create)", async () => {
    const credsPath = tempCreds("CLOUDFLARE_API_TOKEN=tok\nCLOUDFLARE_ZONE_ID=zone-1\n");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        mockJson({
          success: true,
          errors: [],
          messages: [],
          result: [
            { id: "old-id", type: "A", name: "foo.example.com", content: "9.9.9.9", ttl: 1 },
          ],
        }),
      )
      .mockResolvedValueOnce(
        mockJson({ success: true, errors: [], messages: [], result: { id: "old-id" } }),
      )
      .mockResolvedValueOnce(
        mockJson({
          success: true,
          errors: [],
          messages: [],
          result: { id: "new-id", type: "A", name: "foo.example.com", content: "1.2.3.4", ttl: 1 },
        }),
      );

    const result = await run([
      "dns",
      "add",
      "foo.example.com",
      "--type",
      "A",
      "--content",
      "1.2.3.4",
      "--force",
      "--credentials",
      credsPath,
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Replaced A record foo.example.com → 1.2.3.4");
    expect(result.stdout).toContain("id: new-id");
    expect(result.stdout).toContain("(deleted previous record id: old-id)");
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
