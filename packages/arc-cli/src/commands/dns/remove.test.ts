import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runFromArgs } from "../../cli.js";

function tempCreds(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "arc-dns-remove-"));
  const path = join(dir, "cloudflare.env");
  writeFileSync(path, content, { mode: 0o600 });
  return path;
}

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function run(args: readonly string[]): Promise<RunResult> {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  stdout.on("data", (c: Buffer) => stdoutChunks.push(c));
  stderr.on("data", (c: Buffer) => stderrChunks.push(c));
  const exitCode = await runFromArgs(args, { stdout, stderr });
  return {
    exitCode,
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
  };
}

function mockJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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
