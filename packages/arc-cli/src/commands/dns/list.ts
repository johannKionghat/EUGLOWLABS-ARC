import { Command, Option } from "clipanion";

import { CloudflareClient } from "../../cloudflare/client.js";
import {
  DEFAULT_CREDENTIALS_PATH,
  loadCloudflareCredentials,
  resolveZoneId,
} from "../../cloudflare/credentials.js";
import type { DnsRecord } from "../../cloudflare/types.js";

/**
 * `arc dns list` — list DNS records in the configured Cloudflare zone.
 *
 * Filters: --type / --name. Output: table by default, --json for machine-readable.
 * No --dry-run on list (read-only).
 */
export class DnsListCommand extends Command {
  static override paths = [["dns", "list"]];

  static override usage = Command.Usage({
    description: "List Cloudflare DNS records.",
    examples: [
      ["List all records (zone from CLOUDFLARE_ZONE_ID or --zone)", "arc dns list"],
      ["Filter by type", "arc dns list --type=A"],
      ["JSON output", "arc dns list --json"],
    ],
  });

  zone = Option.String("--zone", { description: "Override zone ID (skips auto-discovery)." });
  type = Option.String("--type", { description: "Filter by record type (A, CNAME, TXT)." });
  name = Option.String("--name", { description: "Filter by record name (FQDN)." });
  json = Option.Boolean("--json", false, { description: "Output JSON instead of a table." });
  credentialsPath = Option.String("--credentials", DEFAULT_CREDENTIALS_PATH, {
    description: `Path to credentials env file (default: ${DEFAULT_CREDENTIALS_PATH}).`,
  });

  override async execute(): Promise<number> {
    const credentials = loadCloudflareCredentials(this.credentialsPath);
    const client = new CloudflareClient({
      apiToken: credentials.apiToken,
      baseUrl: credentials.baseUrl,
    });

    let zoneId: string;
    if (this.zone) {
      zoneId = this.zone;
    } else if (credentials.zoneId) {
      zoneId = credentials.zoneId;
    } else if (this.name) {
      zoneId = await resolveZoneId({ client, recordName: this.name, credentials });
    } else {
      this.context.stderr.write(
        "Error: arc dns list requires --zone, CLOUDFLARE_ZONE_ID env var, or --name (for heuristic zone resolution).\n",
      );
      return 1;
    }

    const filters: { type?: string; name?: string } = {};
    if (this.type) filters.type = this.type;
    if (this.name) filters.name = this.name;

    const records = await client.listDnsRecords(zoneId, filters);

    if (this.json) {
      this.context.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
    } else {
      this.printTable(records);
    }
    return 0;
  }

  /**
   * Render records as a fixed-width table.
   *
   * CLI gap: padEnd(38/35) misaligns on names > 38 chars or content > 35 chars
   * (long TXT records, long subdomains). If users complain, switch to cli-table3
   * or compute column widths dynamically.
   */
  private printTable(records: DnsRecord[]): void {
    if (records.length === 0) {
      this.context.stdout.write("No records found.\n");
      return;
    }
    this.context.stdout.write(
      "TYPE   NAME                                  CONTENT                            TTL    PROXIED\n",
    );
    for (const r of records) {
      const proxied = r.proxied ? "yes" : "-";
      this.context.stdout.write(
        `${r.type.padEnd(7)}${r.name.padEnd(38)}${r.content.padEnd(35)}${String(r.ttl).padEnd(7)}${proxied}\n`,
      );
    }
  }
}
