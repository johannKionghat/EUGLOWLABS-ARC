import { resolve } from "node:path";

import { Command, Option } from "clipanion";

import type { ArcConfig } from "@euglowlabs/arc-shared";

import { loadArcConfig } from "../config/index.js";
import { deploy } from "../deploy/deploy.js";
import { HostAdapter } from "../exec/index.js";

/**
 * `arc deploy` — render the project artifacts and apply them on the
 * host machine via {@link HostAdapter}.
 *
 * Single-machine install model — see ADR-0012.
 */
export class DeployCommand extends Command {
  static override paths = [["deploy"]];

  static override usage = Command.Usage({
    description: "Render and apply the project's docker-compose stack.",
    examples: [
      ["Deploy from the current directory", "arc deploy"],
      ["Render only, skip docker compose up", "arc deploy --dry-run"],
    ],
  });

  config = Option.String("--config,-c", "./arc.config.yml", {
    description: "Path to arc.config.yml.",
  });

  outDir = Option.String("--out-dir", "./.arc/generated", {
    description: "Where the generated compose files are written.",
  });

  dryRun = Option.Boolean("--dry-run", false, {
    description: "Render and write files but skip docker compose up.",
  });

  override async execute(): Promise<number> {
    let cfg: ArcConfig;
    try {
      cfg = await loadArcConfig(resolve(this.config));
    } catch (cause) {
      this.context.stderr.write(
        cause instanceof Error ? `${cause.message}\n` : "Failed to load config\n",
      );
      return 1;
    }

    const adapter = new HostAdapter();
    const out = resolve(this.outDir);
    const result = await deploy(cfg, adapter, {
      outDir: out,
      skipCompose: this.dryRun,
      log: (line) => this.context.stdout.write(`${line}\n`),
    });

    if (result.composeRan && result.composeExitCode !== 0) {
      this.context.stderr.write(`docker compose exited with code ${result.composeExitCode}\n`);
      return result.composeExitCode ?? 1;
    }

    this.context.stdout.write(`Deployed ${result.writtenPaths.length} files.\n`);
    return 0;
  }
}
