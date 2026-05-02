import { Command, Option } from "clipanion";

import { readTelemetry, writeTelemetry } from "../telemetry/store.js";

/**
 * `arc config telemetry on|off|status` — manage the local opt-in
 * telemetry preference. Telemetry is OFF by default; the user must
 * explicitly opt in. Anonymous data sent is documented in the README.
 */
export class TelemetryConfigCommand extends Command {
  static override paths = [["config", "telemetry"]];

  static override usage = Command.Usage({
    description: "Enable, disable, or inspect the telemetry preference.",
    examples: [
      ["Show current setting", "arc config telemetry status"],
      ["Opt in", "arc config telemetry on"],
      ["Opt out", "arc config telemetry off"],
    ],
  });

  action = Option.String();

  override async execute(): Promise<number> {
    const action = this.action.toLowerCase();
    if (action === "status") {
      const current = await readTelemetry();
      this.context.stdout.write(`telemetry: ${current.enabled ? "on" : "off"}\n`);
      return 0;
    }
    if (action === "on" || action === "off") {
      await writeTelemetry({ enabled: action === "on" });
      this.context.stdout.write(`telemetry: ${action}\n`);
      return 0;
    }
    this.context.stderr.write("Expected: on | off | status\n");
    return 1;
  }
}
