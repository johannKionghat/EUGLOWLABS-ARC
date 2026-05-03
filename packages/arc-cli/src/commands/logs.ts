import { Command, Option } from "clipanion";

import { HostAdapter } from "../exec/index.js";
import { tailLogs } from "../logs/tail.js";

/**
 * `arc logs <service>` — tail the logs of a single docker container.
 */
export class LogsCommand extends Command {
  static override paths = [["logs"]];

  static override usage = Command.Usage({
    description: "Tail the logs of a service.",
    examples: [
      ["Tail logs of openclaw", "arc logs openclaw"],
      ["Print last 50 lines without following", "arc logs uptime-kuma --tail 50 --no-follow"],
    ],
  });

  service = Option.String();

  tail = Option.String("--tail", "100", {
    description: "Number of historical lines to print first.",
  });

  noFollow = Option.Boolean("--no-follow", false, {
    description: "Do not stream new output, exit after the historical buffer.",
  });

  override async execute(): Promise<number> {
    const adapter = new HostAdapter();
    const tail = Number.parseInt(this.tail, 10);
    if (!Number.isFinite(tail) || tail < 0) {
      this.context.stderr.write("--tail must be a non-negative integer\n");
      return 1;
    }
    const result = await tailLogs(adapter, this.service, {
      tail,
      follow: !this.noFollow,
      onLine: (line) => this.context.stdout.write(`${line}\n`),
    });
    return result.exitCode;
  }
}
