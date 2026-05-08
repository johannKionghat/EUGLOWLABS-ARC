import { Command } from "clipanion";

import { formatVersion } from "../version.js";

/**
 * `arc version` — print the CLI version, git SHA and build date.
 *
 * Prints the canonical `X.Y.Z (sha=ABC, built=ISO_DATE)` string per
 * ADR-0016 §1. The built-in clipanion `--version` flag (registered in
 * `cli.ts`) prints the short `VERSION` only ; this subcommand exposes
 * the full metadata for support / bug reports.
 */
export class VersionCommand extends Command {
  static override paths = [["version"]];

  static override usage = Command.Usage({
    description: "Print the EuglowLabs ARC CLI version, git SHA and build date.",
    examples: [["Print version", "arc version"]],
  });

  override async execute(): Promise<number> {
    this.context.stdout.write(`arc ${formatVersion()}\n`);
    return 0;
  }
}
