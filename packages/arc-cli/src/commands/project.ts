import { Command, Option } from "clipanion";

import { LocalAdapter } from "../exec/index.js";
import { addProject } from "../projects/add.js";
import { CoolifyClient, type CoolifyClientOptions } from "../projects/coolify.js";

function readCoolifyOpts(
  url: string | undefined,
  token: string | undefined,
): CoolifyClientOptions | null {
  const baseUrl = url ?? process.env.COOLIFY_URL;
  const apiToken = token ?? process.env.COOLIFY_API_TOKEN;
  if (baseUrl === undefined || apiToken === undefined) return null;
  return { baseUrl, apiToken };
}

const COOLIFY_OPTS_HELP =
  "Coolify base URL and API token are required (--coolify-url / --coolify-token or env vars)\n";

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
    const opts = readCoolifyOpts(this.coolifyUrl, this.coolifyToken);
    if (opts === null) {
      this.context.stderr.write(COOLIFY_OPTS_HELP);
      return 1;
    }
    const adapter = new LocalAdapter();
    try {
      const result = await addProject(adapter, {
        name: this.name,
        coolify: new CoolifyClient(opts),
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

/**
 * `arc project list` — list projects known to Coolify.
 */
export class ProjectListCommand extends Command {
  static override paths = [["project", "list"]];

  static override usage = Command.Usage({
    description: "List Coolify projects.",
  });

  coolifyUrl = Option.String("--coolify-url", { required: false });
  coolifyToken = Option.String("--coolify-token", { required: false });

  override async execute(): Promise<number> {
    const opts = readCoolifyOpts(this.coolifyUrl, this.coolifyToken);
    if (opts === null) {
      this.context.stderr.write(COOLIFY_OPTS_HELP);
      return 1;
    }
    try {
      const projects = await new CoolifyClient(opts).listProjects();
      if (projects.length === 0) {
        this.context.stdout.write("(no projects)\n");
        return 0;
      }
      for (const p of projects) {
        this.context.stdout.write(`${p.name.padEnd(30)} ${p.uuid}\n`);
      }
      return 0;
    } catch (cause) {
      this.context.stderr.write(
        cause instanceof Error ? `${cause.message}\n` : "project list failed\n",
      );
      return 1;
    }
  }
}

/**
 * `arc project deploy <name>` — trigger a Coolify deploy for a project.
 *
 * Looks the project up by name (case-sensitive), then POSTs to its
 * deploy endpoint. Useful from CI hooks to fire an out-of-band redeploy.
 */
export class ProjectDeployCommand extends Command {
  static override paths = [["project", "deploy"]];

  static override usage = Command.Usage({
    description: "Trigger a Coolify deploy for a project by name.",
  });

  name = Option.String();
  coolifyUrl = Option.String("--coolify-url", { required: false });
  coolifyToken = Option.String("--coolify-token", { required: false });

  override async execute(): Promise<number> {
    const opts = readCoolifyOpts(this.coolifyUrl, this.coolifyToken);
    if (opts === null) {
      this.context.stderr.write(COOLIFY_OPTS_HELP);
      return 1;
    }
    try {
      const client = new CoolifyClient(opts);
      const projects = await client.listProjects();
      const match = projects.find((p) => p.name === this.name);
      if (match === undefined) {
        this.context.stderr.write(`Project not found: ${this.name}\n`);
        return 1;
      }
      await client.deployProject(match.uuid);
      this.context.stdout.write(`Deploy triggered for ${match.name}\n`);
      return 0;
    } catch (cause) {
      this.context.stderr.write(
        cause instanceof Error ? `${cause.message}\n` : "project deploy failed\n",
      );
      return 1;
    }
  }
}
