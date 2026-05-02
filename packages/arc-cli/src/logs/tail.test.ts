import { describe, expect, it } from "vitest";

import { MockAdapter } from "../exec/index.js";
import { tailLogs } from "./tail.js";

describe("tailLogs", () => {
  it("invokes docker logs with the configured tail count and follow flag", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("docker logs --tail 50 --follow openclaw", {
      stdout: "line1\nline2\n",
      exitCode: 0,
    });
    const lines: string[] = [];
    const result = await tailLogs(adapter, "openclaw", {
      tail: 50,
      follow: true,
      onLine: (l) => lines.push(l),
    });
    expect(result.exitCode).toBe(0);
    expect(lines).toEqual(["line1", "line2"]);
  });

  it("omits --follow when follow=false", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("docker logs --tail 100 uptime-kuma", { exitCode: 0 });
    await tailLogs(adapter, "uptime-kuma", { follow: false });
    expect(
      adapter.calls.some(
        (c) => c.method === "exec" && c.cmd === "docker logs --tail 100 uptime-kuma",
      ),
    ).toBe(true);
  });
});
