import { Command, Option } from "clipanion";

import { LocalAdapter } from "../exec/index.js";

/**
 * `arc restart <service>` — restart a single docker container.
 */
export class RestartCommand extends Command {
  static override paths = [["restart"]];

  static override usage = Command.Usage({
    description: "Restart a service.",
    examples: [["Restart openclaw", "arc restart openclaw"]],
  });

  service = Option.String();

  override async execute(): Promise<number> {
    const adapter = new LocalAdapter();
    const result = await adapter.exec(`docker restart ${this.service}`, {
      onChunk: (chunk) => this.context.stdout.write(chunk.data),
    });
    return result.exitCode;
  }
}
