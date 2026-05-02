import { Command, Option } from "clipanion";

import { LocalAdapter } from "../exec/index.js";
import { addProject } from "../projects/add.js";
import { CoolifyClient } from "../projects/coolify.js";

/**
 * `arc project add <name>` — create a project in Coolify and provision
 * a Postgres database with the same slug.
 */
export class ProjectAddCommand extends Command {
  static override paths = [["project", "add"]];

  static override usage = Command.Usage({
    description: "Add a new project (Coolify + Postgres database).",
    examples: [["Add euglow", "arc project add euglow"]],
  });

  name = Option.String();

  coolifyUrl = Option.String("--coolify-url", {
    description: "Coolify base URL. Falls back to COOLIFY_URL env var.",
    required: false,
  });

  coolifyToken = Option.String("--coolify-token", {
    description: "Coolify API token. Falls back to COOLIFY_API_TOKEN env var.",
    required: false,
  });

  override async execute(): Promise<number> {
    const url = this.coolifyUrl ?? process.env.COOLIFY_URL;
    const token = this.coolifyToken ?? process.env.COOLIFY_API_TOKEN;
    if (url === undefined || token === undefined) {
      this.context.stderr.write(
        "Coolify base URL and API token are required (--coolify-url / --coolify-token or env vars)\n",
      );
      return 1;
    }
    const adapter = new LocalAdapter();
    try {
      const result = await addProject(adapter, {
        name: this.name,
        coolify: new CoolifyClient({ baseUrl: url, apiToken: token }),
      });
      this.context.stdout.write(
        `Project ${result.project.name} (${result.project.uuid}) created\n`,
      );
      this.context.stdout.write(
        `Database ${this.name}: ${result.databaseCreated ? "created" : "FAILED"}\n`,
      );
      return result.exitCode;
    } catch (cause) {
      this.context.stderr.write(
        cause instanceof Error ? `${cause.message}\n` : "project add failed\n",
      );
      return 1;
    }
  }
}
