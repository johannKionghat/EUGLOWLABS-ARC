import { Command, Option } from "clipanion";

import { runSetup } from "../setup/orchestrate.js";

/**
 * `arc setup` — interactively configure ARC and (with `--apply`) apply
 * the local stack.
 *
 * Without `--apply` (INSTALL-001 contract) : prompt for missing values,
 * write `~/.arc/arc.config.yml`, handle the six idempotence cases. No
 * Ansible, no compose generation.
 *
 * With `--apply` (INSTALL-002 contract) : after the config is written
 * or validated, generate `~/.arc/compose/docker-compose.{prod,sandbox,
 * agents}.yml` and run the bundled Ansible playbook on `localhost`.
 * The stack is committed via `~/.arc/state.json` only after the
 * playbook returns 0.
 */
export class SetupCommand extends Command {
  static override paths = [["setup"]];

  static override usage = Command.Usage({
    description: "Configure ARC interactively, then optionally apply the local stack via Ansible.",
    examples: [
      ["First-time setup on a fresh host (config only)", "arc setup"],
      ["Configure AND apply the stack on the host", "arc setup --apply"],
      ["Force overwrite + apply without idempotence prompts", "arc setup --apply --force"],
      ["Force overwrite of an existing config (no apply)", "arc setup --force"],
    ],
  });

  force = Option.Boolean("--force,-f", false, {
    description:
      "Skip confirmation prompts (config overwrite + apply idempotence). Has no apply-side effect without --apply.",
  });

  apply = Option.Boolean("--apply", false, {
    description: "Generate composes and run the Ansible playbook after the config is written.",
  });

  override async execute(): Promise<number> {
    return await runSetup({ force: this.force, apply: this.apply });
  }
}
