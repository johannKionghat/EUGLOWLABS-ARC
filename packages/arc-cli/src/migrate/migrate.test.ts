import { type ArcConfig, arcConfigSchema } from "@euglowlabs/arc-shared";
import { describe, expect, it } from "vitest";

import { MockAdapter } from "../exec/index.js";
import { migrate } from "./migrate.js";

function cfg(): ArcConfig {
  return arcConfigSchema.parse({
    project: "johann-stack",
    target: "local",
    domain: "mondomaine.dev",
    email: "johann@mondomaine.dev",
    dns: {
      provider: "cloudflare",
      zone: "mondomaine.dev",
      api_token: "cf-token",
    },
  });
}

describe("migrate", () => {
  it("runs backup → copy → deploy → restore in order", async () => {
    const source = new MockAdapter();
    const target = new MockAdapter();

    const result = await migrate(cfg(), {
      source,
      target,
      sourceBackupDir: "/srv/local-backups",
      targetBackupDir: "/srv/arc/backups",
      targetOutDir: "/srv/arc",
      volumes: [],
    });

    // backup ran on source
    expect(result.backup.artifacts).toHaveLength(1);
    expect(result.backup.artifacts[0]?.kind).toBe("postgres");

    // copy to target
    expect(target.calls.some((c) => c.method === "copyFile")).toBe(true);

    // deploy ran on target with the four files
    expect(result.deploy.writtenPaths.length).toBe(4);
    expect(result.deploy.composeRan).toBe(true);

    // postgres restore was attempted (exit 0 from default mock response)
    expect(result.restoreExitCodes).toEqual([0]);
  });
});
