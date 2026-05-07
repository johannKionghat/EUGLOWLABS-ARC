import { afterEach, describe, expect, it, vi } from "vitest";

import { mockJson, run, tempCreds } from "./test-helpers.js";

function mockListRecordsOk(records: unknown[]): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    mockJson({ success: true, errors: [], messages: [], result: records }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("arc dns list", () => {
  it("renders a table with records", async () => {
    const credsPath = tempCreds("CLOUDFLARE_API_TOKEN=tok\nCLOUDFLARE_ZONE_ID=zone-1\n");
    mockListRecordsOk([
      {
        id: "r1",
        type: "A",
        name: "foo.example.com",
        content: "1.2.3.4",
        ttl: 1,
        proxied: true,
      },
    ]);
    const result = await run(["dns", "list", "--credentials", credsPath]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("foo.example.com");
    expect(result.stdout).toContain("1.2.3.4");
    expect(result.stdout).toContain("yes");
  });

  it("--json emits machine-readable output", async () => {
    const credsPath = tempCreds("CLOUDFLARE_API_TOKEN=tok\nCLOUDFLARE_ZONE_ID=zone-1\n");
    mockListRecordsOk([
      { id: "r1", type: "A", name: "foo.example.com", content: "1.2.3.4", ttl: 1 },
    ]);
    const result = await run(["dns", "list", "--credentials", credsPath, "--json"]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout.trim()) as Array<{ id: string }>;
    expect(parsed[0]?.id).toBe("r1");
  });

  it("errors when no zone hint is provided", async () => {
    const credsPath = tempCreds("CLOUDFLARE_API_TOKEN=tok\n");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await run(["dns", "list", "--credentials", credsPath]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("requires --zone");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
