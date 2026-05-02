import { type ArcConfig, arcConfigSchema } from "@euglowlabs/arc-shared";
import { describe, expect, it } from "vitest";

import { MockAdapter } from "../exec/index.js";
import { deploy } from "./deploy.js";

function sampleConfig(): ArcConfig {
  return arcConfigSchema.parse({
    project: "johann-stack",
    target: "local",
    domain: "mondomaine.dev",
    email: "johann@mondomaine.dev",
    dns: {
      provider: "cloudflare",
      zone: "mondomaine.dev",
      api_token: "cf-token-xyz",
    },
  });
}

describe("deploy", () => {
  it("writes the four artifacts via the adapter and skips compose when dry-run", async () => {
    const adapter = new MockAdapter();
    const result = await deploy(sampleConfig(), adapter, {
      outDir: "/srv/arc",
      skipCompose: true,
    });

    expect(result.writtenPaths).toEqual([
      "/srv/arc/.env",
      "/srv/arc/docker-compose.prod.yml",
      "/srv/arc/docker-compose.sandbox.yml",
      "/srv/arc/docker-compose.agents.yml",
    ]);
    expect(result.composeRan).toBe(false);
    expect(result.composeExitCode).toBeNull();
  });

  it("invokes docker compose up via the adapter when not in dry-run", async () => {
    const adapter = new MockAdapter();
    adapter.programExec(
      "docker compose -f /srv/arc/docker-compose.prod.yml -f /srv/arc/docker-compose.sandbox.yml -f /srv/arc/docker-compose.agents.yml --env-file /srv/arc/.env up -d",
      { stdout: "started\n", exitCode: 0 },
    );

    const result = await deploy(sampleConfig(), adapter, { outDir: "/srv/arc" });

    expect(result.composeRan).toBe(true);
    expect(result.composeExitCode).toBe(0);
    expect(
      adapter.calls.some((c) => c.method === "exec" && c.cmd.startsWith("docker compose")),
    ).toBe(true);
  });

  it("propagates non-zero exit codes from compose without throwing", async () => {
    const adapter = new MockAdapter();
    adapter.programExec(
      "docker compose -f /srv/arc/docker-compose.prod.yml -f /srv/arc/docker-compose.sandbox.yml -f /srv/arc/docker-compose.agents.yml --env-file /srv/arc/.env up -d",
      { stdout: "", stderr: "boom\n", exitCode: 1 },
    );
    const result = await deploy(sampleConfig(), adapter, { outDir: "/srv/arc" });
    expect(result.composeExitCode).toBe(1);
    expect(result.composeRan).toBe(true);
  });
});
