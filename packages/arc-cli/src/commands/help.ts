import { Command } from "clipanion";

import { renderBanner } from "../banner.js";

/**
 * `arc help` — print the ASCII banner followed by the global usage.
 *
 * Replaces Clipanion's built-in HelpCommand so the EuglowLabs ARC
 * branding is shown for the three root help entry points:
 * `arc help`, `arc -h`, `arc --help`.
 *
 * Sub-command help (e.g. `arc version --help`) is rendered by
 * Clipanion's per-command help mechanism, which does not invoke this
 * command — so the banner intentionally only appears at the root.
 */
export class HelpCommand extends Command {
  static override paths = [["help"], ["-h"], ["--help"]];

  static override usage = Command.Usage({
    description: "Show the EuglowLabs ARC help.",
    examples: [["Show help", "arc help"]],
  });

  override async execute(): Promise<number> {
    renderBanner(this.context.stdout);
    this.context.stdout.write(this.cli.usage(null));
    return 0;
  }
}
