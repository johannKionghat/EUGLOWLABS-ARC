import { resolve } from "node:path";

import { Command, Option } from "clipanion";

import { loadArcConfig } from "../config/index.js";
import { LocalAdapter, VPSAdapter } from "../exec/index.js";
import { migrate } from "../migrate/migrate.js";

/**
 * `arc migrate --from=local --to=<host>` — copy the project from the
 * source adapter to the destination, then redeploy.
 *
 * Requires an SSH user (--ssh-user) and a private key path
 * (--ssh-key) for the VPS. The function-level migration logic is in
 * src/migrate/migrate.ts.
 */
export class MigrateCommand extends Command {
  static override paths = [["migrate"]];

  static override usage = Command.Usage({
    description: "Migrate a project from local to a remote VPS.",
  });

  from = Option.String("--from", "local", { description: "Source adapter." });
  to = Option.String("--to", { description: "Target VPS host (IP or hostname).", required: true });
  sshUser = Option.String("--ssh-user", "root");
  sshKey = Option.String("--ssh-key", "~/.ssh/id_ed25519");

  config = Option.String("--config,-c", "./arc.config.yml");

  override async execute(): Promise<number> {
    if (this.from !== "local") {
      this.context.stderr.write("Only --from=local is supported today\n");
      return 1;
    }
    const cfg = await loadArcConfig(resolve(this.config));
    const source = new LocalAdapter();
    const target = new VPSAdapter({
      host: this.to,
      username: this.sshUser,
      privateKeyPath: this.sshKey,
    });
    try {
      const result = await migrate(cfg, {
        source,
        target,
        sourceBackupDir: "./backups",
        targetBackupDir: "/srv/arc/backups",
        targetOutDir: "/srv/arc",
        volumes: [],
        log: (line) => this.context.stdout.write(`${line}\n`),
      });
      const failed = result.restoreExitCodes.filter((c) => c !== 0).length;
      if (failed > 0) {
        this.context.stderr.write(`${failed} restore step(s) failed\n`);
        return 1;
      }
      return 0;
    } finally {
      await target.disconnect();
    }
  }
}
