import type { ExecutionAdapter } from "../exec/index.js";
import type { CoolifyClient, CoolifyProject } from "./coolify.js";

export interface AddProjectOptions {
  name: string;
  postgresContainer?: string;
  postgresUser?: string;
  /** Pre-built Coolify client. Pass a fake in tests. */
  coolify: CoolifyClient;
}

export interface AddProjectResult {
  project: CoolifyProject;
  databaseCreated: boolean;
  exitCode: number;
}

/**
 * Register a new user-managed project on the running ARC stack.
 *
 * 1. Create the project in Coolify via its API.
 * 2. Create a Postgres database with the same slug, scoped to the
 *    shared instance (ADR-0007: one DB per project).
 *
 * The function fails fast if Coolify rejects the project name; the
 * caller decides whether to retry or rollback.
 */
export async function addProject(
  adapter: ExecutionAdapter,
  opts: AddProjectOptions,
): Promise<AddProjectResult> {
  const project = await opts.coolify.createProject(opts.name);
  const postgresContainer = opts.postgresContainer ?? "postgres";
  const postgresUser = opts.postgresUser ?? "postgres";
  const sql = `CREATE DATABASE ${opts.name};`;
  const cmd = `docker exec ${postgresContainer} psql -U ${postgresUser} -c "${sql}"`;
  const result = await adapter.exec(cmd);
  return {
    project,
    databaseCreated: result.exitCode === 0,
    exitCode: result.exitCode,
  };
}
