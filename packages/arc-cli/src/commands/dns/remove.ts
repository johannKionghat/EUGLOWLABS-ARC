import { Command, Option } from "clipanion";

import { CloudflareClient } from "../../cloudflare/client.js";
import {
  DEFAULT_CREDENTIALS_PATH,
  loadCloudflareCredentials,
  resolveZoneId,
} from "../../cloudflare/credentials.js";

/**
 * `arc dns remove <name> --type=<A|CNAME|TXT>` — delete a single record.
 *
 * Disambiguation: if multiple records match (name + type), --content filters
 * further. If still ambiguous (>1 match), exits 1 with a "use --content" hint.
 *
 * --dry-run skips credentials + API calls entirely (prints intent only).
 *
 * MVP: no --force flag. CLI gap: when an interactive confirmation is added in
 * the future, introduce --force to skip the prompt.
 */
export class DnsRemoveCommand extends Command {
  static override paths = [["dns", "remove"]];

  static override usage = Command.Usage({
    description: "Remove a Cloudflare DNS record by name + type (+ optional content).",
    examples: [
      ["Remove A record", "arc dns remove foo.example.com --type=A"],
      ["Disambiguate by content", "arc dns remove foo.example.com --type=A --content=1.2.3.4"],
      ["Dry-run", "arc dns remove foo.example.com --type=A --dry-run"],
    ],
  });

  name = Option.String();

  type = Option.String("--type", {
    description: "Record type (A, CNAME, TXT). Required.",
    required: true,
  });
  content = Option.String("--content", {
    description: "Disambiguate when multiple records match (name + type).",
  });
  zone = Option.String("--zone", {
    description: "Override zone ID (skips auto-discovery).",
  });
  dryRun = Option.Boolean("--dry-run", false, {
    description: "Print intent without contacting the API. Skips credentials loading.",
  });
  credentialsPath = Option.String("--credentials", DEFAULT_CREDENTIALS_PATH, {
    description: `Path to credentials env file (default: ${DEFAULT_CREDENTIALS_PATH}).`,
  });

  override async execute(): Promise<number> {
    if (this.dryRun) {
      const contentSuffix = this.content ? ` (content=${this.content})` : "";
      this.context.stdout.write(
        `[dry-run] Would search and delete: ${this.type} ${this.name}${contentSuffix}\n`,
      );
      return 0;
    }

    const credentials = loadCloudflareCredentials(this.credentialsPath);
    const client = new CloudflareClient({
      apiToken: credentials.apiToken,
      baseUrl: credentials.baseUrl,
    });
    const zoneId = await resolveZoneId({
      client,
      recordName: this.name,
      credentials,
      override: this.zone,
    });

    const records = await client.listDnsRecords(zoneId, {
      name: this.name,
      type: this.type,
    });
    const matches = this.content ? records.filter((r) => r.content === this.content) : records;
    const [target, ...others] = matches;

    if (target === undefined) {
      const contentSuffix = this.content ? ` with content=${this.content}` : "";
      this.context.stderr.write(
        `Error: No ${this.type} record found for ${this.name}${contentSuffix}.\n`,
      );
      return 1;
    }
    if (others.length > 0) {
      this.context.stderr.write(
        `Error: Multiple ${this.type} records for ${this.name}. Use --content=<value> to disambiguate. Found:\n`,
      );
      for (const r of matches) {
        this.context.stderr.write(`  - ${r.content} (id: ${r.id})\n`);
      }
      return 1;
    }

    await client.deleteDnsRecord(zoneId, target.id);
    this.context.stdout.write(`Deleted ${this.type} ${this.name} (id: ${target.id})\n`);
    return 0;
  }
}
