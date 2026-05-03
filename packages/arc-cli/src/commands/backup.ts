import { Command, Option } from "clipanion";

import { runBackup } from "../backup/run.js";
import { HostAdapter } from "../exec/index.js";

/**
 * `arc backup` — snapshot Postgres + named volumes into ./backups.
 */
export class BackupCommand extends Command {
  static override paths = [["backup"]];

  static override usage = Command.Usage({
    description: "Snapshot Postgres and named volumes.",
    examples: [
      ["Default backup", "arc backup"],
      ["Pick a custom directory", "arc backup --out-dir /var/arc/backups"],
    ],
  });

  outDir = Option.String("--out-dir", "./backups", {
    description: "Where snapshot files are written.",
  });

  postgresContainer = Option.String("--postgres", "postgres", {
    description: "Postgres container name.",
  });

  volumes = Option.Array("--volume", [] as string[], {
    description: "Named docker volume to snapshot (repeatable).",
  });

  override async execute(): Promise<number> {
    const adapter = new HostAdapter();
    const result = await runBackup(adapter, {
      outDir: this.outDir,
      postgresContainer: this.postgresContainer,
      volumes: this.volumes,
    });
    let failed = 0;
    for (const art of result.artifacts) {
      const status = art.exitCode === 0 ? "ok" : `fail(${art.exitCode})`;
      this.context.stdout.write(`${art.kind.padEnd(8)} ${status.padEnd(8)} ${art.path}\n`);
      if (art.exitCode !== 0) failed += 1;
    }
    return failed === 0 ? 0 : 1;
  }
}
