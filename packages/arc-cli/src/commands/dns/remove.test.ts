import { afterEach, describe, expect, it, vi } from "vitest";

import { mockJson, run, tempCreds } from "./test-helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("arc dns remove", () => {
  it("--dry-run prints intent without any fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await run(["dns", "remove", "foo.example.com", "--type", "A", "--dry-run"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[dry-run]");
    expect(result.stdout).toContain("A foo.example.com");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("removes a single matching record", async () => {
    const credsPath = tempCreds("CLOUDFLARE_API_TOKEN=tok\nCLOUDFLARE_ZONE_ID=zone-1\n");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        mockJson({
          success: true,
          errors: [],
          messages: [],
          result: [{ id: "r1", type: "A", name: "foo.example.com", content: "1.2.3.4", ttl: 1 }],
        }),
      )
      .mockResolvedValueOnce(
        mockJson({ success: true, errors: [], messages: [], result: { id: "r1" } }),
      );

    const result = await run([
      "dns",
      "remove",
      "foo.example.com",
      "--type",
      "A",
      "--credentials",
      credsPath,
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Deleted A foo.example.com");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("errors when no record matches", async () => {
    const credsPath = tempCreds("CLOUDFLARE_API_TOKEN=tok\nCLOUDFLARE_ZONE_ID=zone-1\n");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockJson({ success: true, errors: [], messages: [], result: [] }),
    );
    const result = await run([
      "dns",
      "remove",
      "missing.example.com",
      "--type",
      "A",
      "--credentials",
      credsPath,
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No A record found");
  });
});
