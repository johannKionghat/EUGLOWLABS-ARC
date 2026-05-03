import { Command, Option } from "clipanion";

import { listBackups, restoreBackup } from "../backup/restore.js";
import { HostAdapter } from "../exec/index.js";

/**
 * `arc restore [<backup-id>]` — list available backups, or restore one.
 *
 * Without arguments: prints the list of recognised artifacts in
 * `--dir`. With `<backup-id>` (a file name from the list): restores
 * that artifact through the adapter.
 */
export class RestoreCommand extends Command {
  static override paths = [["restore"]];

  static override usage = Command.Usage({
    description: "List or restore a backup artifact.",
    examples: [
      ["List available backups", "arc restore"],
      ["Restore a postgres dump", "arc restore db_20260502T030405Z.sql"],
      [
        "Restore a volume snapshot",
        "arc restore volume_arc_postgres_data_20260502T030405Z.tar.gz --target arc_postgres_data",
      ],
    ],
  });

  backupId = Option.String({ required: false });

  dir = Option.String("--dir", "./backups", {
    description: "Directory where backups live on the adapter.",
  });

  target = Option.String("--target", {
    description: "Target volume name when restoring a volume snapshot.",
  });

  override async execute(): Promise<number> {
    const adapter = new HostAdapter();

    if (this.backupId === undefined) {
      const entries = await listBackups(adapter, { dir: this.dir });
      if (entries.length === 0) {
        this.context.stdout.write(`(no backups found in ${this.dir})\n`);
        return 0;
      }
      for (const e of entries) {
        this.context.stdout.write(`${e.kind.padEnd(8)} ${e.path}\n`);
      }
      return 0;
    }

    const path = `${this.dir}/${this.backupId}`;
    try {
      const result = await restoreBackup(adapter, {
        path,
        targetVolume: this.target,
      });
      return result.exitCode;
    } catch (cause) {
      this.context.stderr.write(cause instanceof Error ? `${cause.message}\n` : "restore failed\n");
      return 1;
    }
  }
}
