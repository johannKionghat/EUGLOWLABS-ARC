import { describe, expect, it } from "vitest";

import { MockAdapter } from "../exec/index.js";
import { runBackup } from "./run.js";

const fixedDate = new Date("2026-05-02T03:04:05.000Z");

describe("runBackup", () => {
  it("dumps postgres into a timestamped file", async () => {
    const adapter = new MockAdapter();
    const result = await runBackup(adapter, {
      outDir: "/srv/arc/backups",
      now: () => fixedDate,
    });
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]?.path).toBe("/srv/arc/backups/db_20260502T030405Z.sql");
    expect(result.artifacts[0]?.kind).toBe("postgres");
  });

  it("snapshots each named volume into a tar.gz", async () => {
    const adapter = new MockAdapter();
    const result = await runBackup(adapter, {
      outDir: "/srv/arc/backups",
      volumes: ["arc_postgres_data", "arc_ollama_data"],
      now: () => fixedDate,
    });
    expect(result.artifacts).toHaveLength(3);
    expect(result.artifacts[1]?.path).toBe(
      "/srv/arc/backups/volume_arc_postgres_data_20260502T030405Z.tar.gz",
    );
    expect(result.artifacts[2]?.path).toBe(
      "/srv/arc/backups/volume_arc_ollama_data_20260502T030405Z.tar.gz",
    );
  });

  it("propagates non-zero exit codes per artifact", async () => {
    const adapter = new MockAdapter();
    adapter.programExec(
      "docker exec postgres pg_dumpall -U postgres > /tmp/db_20260502T030405Z.sql",
      { exitCode: 1 },
    );
    const result = await runBackup(adapter, {
      outDir: "/tmp",
      now: () => fixedDate,
    });
    expect(result.artifacts[0]?.exitCode).toBe(1);
  });
});
