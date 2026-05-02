import { resolve } from "node:path";

import { intro, outro } from "@clack/prompts";
import { Command, Option } from "clipanion";

import { promptForConfig } from "../init/prompts.js";
import { writeArcConfig } from "../init/write.js";

/**
 * `arc init` — interactively create an `arc.config.yml` in the current
 * directory (or at the path given by `--out`).
 *
 * The command refuses to overwrite an existing file unless `--force` is
 * passed. Validation is enforced by the prompt-level validators; the
 * resulting file is guaranteed to round-trip through `loadArcConfig`.
 */
export class InitCommand extends Command {
  static override paths = [["init"]];

  static override usage = Command.Usage({
    description: "Interactively create an arc.config.yml.",
    examples: [
      ["Create the default arc.config.yml", "arc init"],
      ["Overwrite an existing arc.config.yml", "arc init --force"],
      ["Write to a custom path", "arc init --out ./infra/arc.config.yml"],
    ],
  });

  out = Option.String("--out,-o", "./arc.config.yml", {
    description: "Output path for the generated config.",
  });

  force = Option.Boolean("--force,-f", false, {
    description: "Overwrite an existing file at the output path.",
  });

  override async execute(): Promise<number> {
    intro("EuglowLabs ARC — init");

    const draft = await promptForConfig();
    if (draft === null) {
      outro("init cancelled");
      return 1;
    }

    const target = resolve(this.out);
    try {
      await writeArcConfig(target, draft, { force: this.force });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      outro(`failed to write config: ${message}`);
      return 1;
    }

    outro(`Wrote ${target}`);
    return 0;
  }
}
