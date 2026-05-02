import { describe, expect, it } from "vitest";

import { MockAdapter } from "../exec/index.js";
import { runAnsiblePlaybook } from "./run.js";

describe("runAnsiblePlaybook", () => {
  it("invokes ansible-playbook with the given path", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("ansible-playbook /tmp/play.yml", { exitCode: 0 });
    const result = await runAnsiblePlaybook(adapter, "/tmp/play.yml");
    expect(result.exitCode).toBe(0);
    expect(adapter.calls.some((c) => c.method === "exec")).toBe(true);
  });

  it("forwards inventory, extraVars, check flag and streams lines", async () => {
    const adapter = new MockAdapter();
    const cmd = 'ansible-playbook --extra-vars "foo=1 bar=2" --check -i /etc/hosts /tmp/play.yml';
    adapter.programExec(cmd, { stdout: "PLAY\nTASK\n", exitCode: 0 });

    const lines: string[] = [];
    const result = await runAnsiblePlaybook(adapter, "/tmp/play.yml", {
      inventory: "/etc/hosts",
      check: true,
      extraVars: { foo: "1", bar: "2" },
      onLine: (line) => lines.push(line),
    });

    expect(result.exitCode).toBe(0);
    expect(lines).toContain("PLAY");
    expect(lines).toContain("TASK");
  });

  it("propagates non-zero exit codes", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("ansible-playbook /tmp/play.yml", {
      exitCode: 2,
      stderr: "fatal\n",
    });
    const result = await runAnsiblePlaybook(adapter, "/tmp/play.yml");
    expect(result.exitCode).toBe(2);
  });
});
