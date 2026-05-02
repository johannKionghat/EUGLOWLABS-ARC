import { Builtins, Cli } from "clipanion";
import type { BaseContext } from "clipanion";

import { BackupCommand } from "./commands/backup.js";
import { DeployCommand } from "./commands/deploy.js";
import { HelpCommand } from "./commands/help.js";
import { InitCommand } from "./commands/init.js";
import { LogsCommand } from "./commands/logs.js";
import { ProjectAddCommand } from "./commands/project.js";
import { RestartCommand } from "./commands/restart.js";
import { RestoreCommand } from "./commands/restore.js";
import { StatusCommand } from "./commands/status.js";
import { VersionCommand } from "./commands/version.js";
import { VERSION } from "./version.js";

/**
 * Build a fresh, fully-configured Clipanion CLI instance for EuglowLabs ARC.
 *
 * Each call returns a new instance so tests can run in isolation without
 * sharing mutable state.
 */
export function buildCli(): Cli<BaseContext> {
  const cli = new Cli<BaseContext>({
    binaryLabel: "EuglowLabs ARC",
    binaryName: "arc",
    binaryVersion: VERSION,
  });

  cli.register(HelpCommand);
  cli.register(Builtins.VersionCommand);
  cli.register(VersionCommand);
  cli.register(InitCommand);
  cli.register(DeployCommand);
  cli.register(StatusCommand);
  cli.register(LogsCommand);
  cli.register(RestartCommand);
  cli.register(BackupCommand);
  cli.register(RestoreCommand);
  cli.register(ProjectAddCommand);

  return cli;
}

/**
 * Run the CLI with the given argv slice and a custom context.
 *
 * Useful for tests: callers provide `stdout` / `stderr` writables and
 * receive the resolved exit code without relying on `process.exit`.
 */
export function runFromArgs(
  args: readonly string[],
  context: Partial<BaseContext> = {},
): Promise<number> {
  const cli = buildCli();
  const merged: BaseContext = {
    stdin: context.stdin ?? process.stdin,
    stdout: context.stdout ?? process.stdout,
    stderr: context.stderr ?? process.stderr,
    env: context.env ?? process.env,
    colorDepth: context.colorDepth ?? 1,
  };
  return cli.run([...args], merged);
}
