import { Command } from "clipanion";

import { formatVersion } from "../version.js";

/**
 * Canonical upgrade instructions printed by `arc upgrade`.
 *
 * Per ADR-0016 §3 (Update mechanism), the MVP upgrade strategy is to
 * re-run `install.sh` (idempotent overwrite of the binary). Real
 * `arc self-update` is deferred to backlog `DIST-003`.
 *
 * The output covers : current version (formatVersion), the curl
 * one-liner pointing at the canonical
 * `install-arc.euglowlabs.com` host (ADR-0016 §3 — convention
 * `install-<produit>.euglowlabs.com`), the idempotence note, and a
 * release notes link for changelog inspection before upgrading.
 *
 * The pattern is `curl ... | sh` (no `sudo` at the top level) ;
 * `install.sh` itself runs targeted `sudo` for operations that need
 * root (e.g. dropping the binary in `/usr/local/bin/`). This matches
 * Docker / Tailscale / Bun / Deno conventions.
 */
function buildUpgradeMessage(): string {
  return [
    `arc ${formatVersion()}`,
    "",
    "To upgrade ARC, re-run the installer:",
    "    curl -fsSL https://install-arc.euglowlabs.com | sh",
    "",
    "The installer is idempotent — your ~/.arc/ config and running stack are preserved.",
    "Release notes: https://github.com/johannKionghat/EUGLOWLABS-ARC/releases",
  ].join("\n");
}

/**
 * `arc upgrade` — print the upgrade instructions.
 *
 * Stub implementation per ADR-0016 §3. Does not download or apply
 * anything : the user re-runs `install.sh` themselves. A real
 * `arc self-update` is tracked as backlog `DIST-003`.
 */
export class UpgradeCommand extends Command {
  static override paths = [["upgrade"]];

  static override usage = Command.Usage({
    description: "Print the upgrade instructions for the EuglowLabs ARC CLI.",
    examples: [["Show how to upgrade ARC", "arc upgrade"]],
  });

  override async execute(): Promise<number> {
    this.context.stdout.write(`${buildUpgradeMessage()}\n`);
    return 0;
  }
}
