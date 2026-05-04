import { Command, Option } from "clipanion";

import { runSetup } from "../setup/orchestrate.js";

/**
 * `arc setup` — interactively configure ARC and (in INSTALL-002) apply
 * the local stack.
 *
 * INSTALL-001 scope : core orchestration only — prompt the user, write
 * `~/.arc/arc.config.yml`, handle the six idempotence cases (cf.
 * `setup/idempotence.ts`). The Ansible run + compose generation are
 * delivered by INSTALL-002 ; the `--apply` flag mentioned in the
 * "Réutiliser" hint will land with that task.
 */
export class SetupCommand extends Command {
  static override paths = [["setup"]];

  static override usage = Command.Usage({
    description: "Configure ARC interactively and write ~/.arc/arc.config.yml.",
    examples: [
      ["First-time setup on a fresh host", "arc setup"],
      ["Force overwrite an existing config without prompts", "arc setup --force"],
    ],
  });

  force = Option.Boolean("--force,-f", false, {
    description: "Overwrite an existing valid config without prompting.",
  });

  override async execute(): Promise<number> {
    return await runSetup({ force: this.force });
  }
}
