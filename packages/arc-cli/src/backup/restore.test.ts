import { describe, expect, it } from "vitest";

import { MockAdapter } from "../exec/index.js";
import { listBackups, restoreBackup } from "./restore.js";

describe("listBackups", () => {
  it("classifies db_*.sql, volume_*.tar.gz, and unknowns", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("ls -1 /backups", {
      stdout: [
        "db_20260502T030405Z.sql",
        "volume_arc_postgres_data_20260502T030405Z.tar.gz",
        "README.md",
        "",
      ].join("\n"),
      exitCode: 0,
    });
    const entries = await listBackups(adapter, { dir: "/backups" });
    expect(entries).toEqual([
      { path: "/backups/db_20260502T030405Z.sql", kind: "postgres" },
      {
        path: "/backups/volume_arc_postgres_data_20260502T030405Z.tar.gz",
        kind: "volume",
      },
      { path: "/backups/README.md", kind: "unknown" },
    ]);
  });

  it("returns [] when ls fails", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("ls -1 /missing", { exitCode: 2 });
    expect(await listBackups(adapter, { dir: "/missing" })).toEqual([]);
  });
});

describe("restoreBackup", () => {
  it("pipes a .sql file into psql inside the postgres container", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("cat /b/db.sql | docker exec -i postgres psql -U postgres", {
      exitCode: 0,
    });
    const result = await restoreBackup(adapter, { path: "/b/db.sql" });
    expect(result.exitCode).toBe(0);
  });

  it("requires a targetVolume for tar.gz restores", async () => {
    const adapter = new MockAdapter();
    await expect(restoreBackup(adapter, { path: "/b/volume_x.tar.gz" })).rejects.toThrow(
      /targetVolume/,
    );
  });

  it("extracts a volume tarball into the target volume via alpine", async () => {
    const adapter = new MockAdapter();
    adapter.programExec(
      "cat /b/volume_x.tar.gz | docker run --rm -i -v target_vol:/data alpine tar -xzf - -C /data",
      { exitCode: 0 },
    );
    const result = await restoreBackup(adapter, {
      path: "/b/volume_x.tar.gz",
      targetVolume: "target_vol",
    });
    expect(result.exitCode).toBe(0);
  });
});
