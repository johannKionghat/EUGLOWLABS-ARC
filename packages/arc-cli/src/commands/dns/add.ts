import { Command, Option } from "clipanion";

import { CloudflareClient } from "../../cloudflare/client.js";
import {
  DEFAULT_CREDENTIALS_PATH,
  loadCloudflareCredentials,
  resolveZoneId,
} from "../../cloudflare/credentials.js";
import { type CreateDnsRecord, DnsRecordTypeSchema } from "../../cloudflare/types.js";

const DEFAULT_COMMENT = "managed-by:arc";

/**
 * `arc dns add <name> --type=<A|CNAME|TXT> --content=<value>` — create a record.
 *
 * Flow:
 *   1. Validate TTL (1 = auto, or 60..86400) and proxied/type compatibility.
 *   2. --dry-run: print intent + exit 0 (no creds, no API).
 *   3. Load creds → resolve zone → list existing records (name+type).
 *   4. If existing > 0 and not --force → multi-line error with 3 suggestions.
 *   5. If --force: delete-then-create (atomic ARC-side, no PATCH).
 *   6. Create record with optional comment (default "managed-by:arc").
 *      Print "Created" or "Replaced ... (deleted previous id: …)".
 */
export class DnsAddCommand extends Command {
  static override paths = [["dns", "add"]];

  static override usage = Command.Usage({
    description: "Create a Cloudflare DNS record (or replace with --force).",
    examples: [
      ["A record", "arc dns add foo.example.com --type=A --content=1.2.3.4"],
      [
        "CNAME with TTL",
        "arc dns add www.example.com --type=CNAME --content=example.com --ttl=300",
      ],
      ["TXT", `arc dns add example.com --type=TXT --content="v=spf1 -all"`],
      ["Replace existing", "arc dns add foo.example.com --type=A --content=5.6.7.8 --force"],
      ["Dry-run", "arc dns add foo.example.com --type=A --content=1.2.3.4 --dry-run"],
    ],
  });

  name = Option.String();

  type = Option.String("--type", {
    description: "Record type (A, CNAME, TXT). Required.",
    required: true,
  });
  content = Option.String("--content", {
    description: "Record content. Required.",
    required: true,
  });
  ttl = Option.String("--ttl", "1", {
    description: "TTL in seconds. 1 = automatic. Otherwise 60..86400.",
  });
  comment = Option.String("--comment", DEFAULT_COMMENT, {
    description: `Optional comment. Default "${DEFAULT_COMMENT}". Use --comment="" to omit.`,
  });
  proxied = Option.Boolean("--proxied", false, {
    description: "Cloudflare proxy (CDN/WAF). A and CNAME only.",
  });
  force = Option.Boolean("--force", false, {
    description: "Replace existing record(s) (delete-then-create).",
  });
  zone = Option.String("--zone", { description: "Override zone ID (skips auto-discovery)." });
  dryRun = Option.Boolean("--dry-run", false, {
    description: "Print intent without API. Skips credentials.",
  });
  credentialsPath = Option.String("--credentials", DEFAULT_CREDENTIALS_PATH, {
    description: `Path to credentials env file (default: ${DEFAULT_CREDENTIALS_PATH}).`,
  });

  override async execute(): Promise<number> {
    // --- input validation (runs even in --dry-run) ---
    const typeResult = DnsRecordTypeSchema.safeParse(this.type);
    if (!typeResult.success) {
      this.context.stderr.write(`Error: --type must be A, CNAME, or TXT. Got: ${this.type}\n`);
      return 1;
    }
    const recordType = typeResult.data;

    const ttlNumber = Number(this.ttl);
    if (
      !Number.isInteger(ttlNumber) ||
      (ttlNumber !== 1 && (ttlNumber < 60 || ttlNumber > 86400))
    ) {
      this.context.stderr.write(
        `Error: --ttl must be 1 (automatic) or between 60 and 86400. Got: ${this.ttl}\n`,
      );
      return 1;
    }

    if (this.proxied && recordType === "TXT") {
      this.context.stderr.write("Error: --proxied is incompatible with --type=TXT.\n");
      return 1;
    }

    // --- dry-run: skip everything ---
    if (this.dryRun) {
      const proxiedSuffix = this.proxied ? ", proxied" : "";
      const commentSuffix = this.comment === "" ? "" : `, comment='${this.comment}'`;
      this.context.stdout.write(
        `[dry-run] Would create ${recordType} ${this.name} → ${this.content} (ttl=${ttlNumber}${proxiedSuffix}${commentSuffix})\n`,
      );
      return 0;
    }

    // --- real path ---
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

    const existing = await client.listDnsRecords(zoneId, {
      name: this.name,
      type: recordType,
    });

    // Collision without --force → multi-line error with 3 suggestions
    const [first] = existing;
    if (first !== undefined && !this.force) {
      this.context.stderr.write(
        `Error: A ${recordType} record already exists for ${this.name} (id: ${first.id}, content: ${first.content}).\n\nTo replace it: arc dns add ${this.name} --type=${recordType} --content=${this.content} --force\nTo remove it first: arc dns remove ${this.name} --type=${recordType}\nTo see all records: arc dns list --type=${recordType} --name=${this.name}\n`,
      );
      return 1;
    }

    // --force: delete-then-create
    const deletedIds: string[] = [];
    if (this.force) {
      for (const r of existing) {
        await client.deleteDnsRecord(zoneId, r.id);
        deletedIds.push(r.id);
      }
    }

    const createReq: CreateDnsRecord = {
      type: recordType,
      name: this.name,
      content: this.content,
      ttl: ttlNumber,
      ...(this.proxied ? { proxied: true } : {}),
      ...(this.comment !== "" ? { comment: this.comment } : {}),
    };
    const created = await client.createDnsRecord(zoneId, createReq);

    if (deletedIds.length > 0) {
      this.context.stdout.write(
        `Replaced ${recordType} record ${this.name} → ${this.content} (id: ${created.id}, ttl: ${created.ttl})\n`,
      );
      for (const oldId of deletedIds) {
        this.context.stdout.write(`  (deleted previous record id: ${oldId})\n`);
      }
    } else {
      const commentSuffix = this.comment === "" ? "" : `, comment: '${this.comment}'`;
      this.context.stdout.write(
        `Created ${recordType} record ${this.name} → ${this.content} (id: ${created.id}, ttl: ${created.ttl}${commentSuffix})\n`,
      );
    }
    return 0;
  }
}
