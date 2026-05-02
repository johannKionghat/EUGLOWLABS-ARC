import type { Writable } from "node:stream";

/**
 * ASCII banner shown at the top of the root help (`arc help`,
 * `arc -h`, `arc --help`).
 *
 * Pure ASCII (no unicode box chars, no emoji, no ANSI colors) so it
 * renders identically in every terminal — including legacy Windows
 * cmd.exe and minimal CI loggers.
 */
export const BANNER = [
  "",
  "  +----------------------------------------------------------+",
  "  |                                                          |",
  "  |                    EuglowLabs ARC                        |",
  "  |                                                          |",
  "  |               Autonomous Resource Cloud                  |",
  "  |                                                          |",
  "  +----------------------------------------------------------+",
  "",
].join("\n");

/**
 * Write the banner to a stream (typically `this.context.stdout` from
 * a Clipanion command).
 */
export function renderBanner(stdout: Writable): void {
  stdout.write(`${BANNER}\n`);
}
