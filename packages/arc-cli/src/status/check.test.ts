import { describe, expect, it } from "vitest";

import { MockAdapter } from "../exec/index.js";
import { checkStatus } from "./check.js";

describe("checkStatus", () => {
  it("parses one JSON object per line and returns service rows", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("docker compose ps --format json", {
      stdout: `${[
        JSON.stringify({ Name: "uptime-kuma", State: "running" }),
        JSON.stringify({ Name: "openclaw", State: "running" }),
      ].join("\n")}\n`,
      exitCode: 0,
    });
    const report = await checkStatus(adapter);
    expect(report.services).toEqual([
      { name: "uptime-kuma", state: "running" },
      { name: "openclaw", state: "running" },
    ]);
    expect(report.adapter).toBe("mock");
    expect(report.exitCode).toBe(0);
  });

  it("returns an empty service list when compose has nothing running", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("docker compose ps --format json", {
      stdout: "",
      exitCode: 0,
    });
    const report = await checkStatus(adapter);
    expect(report.services).toEqual([]);
  });

  it("propagates non-zero exit codes from compose", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("docker compose ps --format json", {
      stdout: "",
      stderr: "no compose project",
      exitCode: 1,
    });
    const report = await checkStatus(adapter);
    expect(report.exitCode).toBe(1);
    expect(report.services).toEqual([]);
  });
});
