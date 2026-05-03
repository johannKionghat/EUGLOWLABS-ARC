import { Command } from "clipanion";

import { HostAdapter } from "../exec/index.js";
import { checkStatus } from "../status/check.js";

/**
 * `arc status` — print the running state of the project's services.
 */
export class StatusCommand extends Command {
  static override paths = [["status"]];

  static override usage = Command.Usage({
    description: "Show the state of the project's services.",
    examples: [["Print status", "arc status"]],
  });

  override async execute(): Promise<number> {
    const adapter = new HostAdapter();
    const report = await checkStatus(adapter);
    this.context.stdout.write(`adapter: ${report.adapter}\n`);
    if (report.services.length === 0) {
      this.context.stdout.write("(no services running)\n");
    } else {
      for (const svc of report.services) {
        this.context.stdout.write(`  ${svc.name.padEnd(30)}${svc.state}\n`);
      }
    }
    return report.exitCode === 0 ? 0 : 1;
  }
}
