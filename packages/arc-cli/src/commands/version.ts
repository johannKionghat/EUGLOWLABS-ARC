import { Command } from "clipanion";

import { VERSION } from "../version.js";

/**
 * `arc version` — print the CLI version.
 *
 * Mirrors the built-in clipanion `--version` flag while exposing it
 * as a regular subcommand for users who prefer `arc version`.
 */
export class VersionCommand extends Command {
  static override paths = [["version"]];

  static override usage = Command.Usage({
    description: "Print the EuglowLabs ARC CLI version.",
    examples: [["Print version", "arc version"]],
  });

  override async execute(): Promise<number> {
    this.context.stdout.write(`arc ${VERSION}\n`);
    return 0;
  }
}
