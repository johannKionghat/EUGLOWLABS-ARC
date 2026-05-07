import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { CloudflareClient } from "./client.js";
import { CloudflareApiError } from "./errors.js";

export const DEFAULT_CREDENTIALS_PATH = join(homedir(), ".arc", "credentials", "cloudflare.env");

export interface CloudflareCredentials {
  apiToken: string;
  zoneId: string | undefined;
  baseUrl: string | undefined;
}

export class CloudflareCredentialsMissingError extends Error {
  override readonly cause: unknown;

  constructor(args: { message: string; cause?: unknown }) {
    super(args.message);
    this.name = "CloudflareCredentialsMissingError";
    this.cause = args.cause;
  }
}

/**
 * Load Cloudflare credentials from a KEY=VALUE env file (mode 0600 on disk).
 * Default path: ~/.arc/credentials/cloudflare.env (cohérent ADR-0015).
 *
 * Recognized keys:
 *   CLOUDFLARE_API_TOKEN     (required)
 *   CLOUDFLARE_ZONE_ID       (optional — fallback auto-discovery via resolveZoneId)
 *   CLOUDFLARE_API_BASE_URL  (optional — overrides default endpoint)
 */
export function loadCloudflareCredentials(path: string): CloudflareCredentials {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch (cause) {
    throw new CloudflareCredentialsMissingError({
      message: `Cloudflare credentials file not found at ${path}. Create it (mode 0600) with at least CLOUDFLARE_API_TOKEN=<your-token>.`,
      cause,
    });
  }

  const env = parseEnvFile(content);
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!apiToken) {
    throw new CloudflareCredentialsMissingError({
      message: `Cloudflare credentials at ${path} is missing CLOUDFLARE_API_TOKEN.`,
    });
  }

  return {
    apiToken,
    zoneId: env.CLOUDFLARE_ZONE_ID,
    baseUrl: env.CLOUDFLARE_API_BASE_URL,
  };
}

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      result[match[1]] = match[2];
    }
  }
  return result;
}

/**
 * Resolve the Cloudflare zone ID for a given DNS record name.
 *
 * Precedence:
 *   1. explicit `override` (e.g., from --zone flag) — highest priority
 *   2. credentials.zoneId (CLOUDFLARE_ZONE_ID in env file)
 *   3. heuristic: last 2 labels of the FQDN → GET /zones?name=<guess>
 *      Filter result strictly by `z.name === guess` (defensive against API
 *      fuzzy matching). Returns the ID of the exact match.
 *
 * For composite TLDs (.co.uk, .com.br, …) the heuristic picks the wrong apex.
 * Operators should set CLOUDFLARE_ZONE_ID explicitly or use --zone.
 * CLI gap: publicsuffix list integration.
 */
export async function resolveZoneId(args: {
  client: CloudflareClient;
  recordName: string;
  credentials: CloudflareCredentials;
  override?: string;
}): Promise<string> {
  if (args.override) return args.override;
  if (args.credentials.zoneId) return args.credentials.zoneId;

  const labels = args.recordName.split(".").filter(Boolean);
  if (labels.length < 2) {
    throw new CloudflareApiError({
      status: 0,
      message: `Cannot derive zone from "${args.recordName}" (need at least 2 labels). Set CLOUDFLARE_ZONE_ID or use --zone.`,
    });
  }

  const candidate = labels.slice(-2).join(".");
  const zones = await args.client.listZones(candidate);
  const exactMatch = zones.find((z) => z.name === candidate);
  if (!exactMatch) {
    throw new CloudflareApiError({
      status: 0,
      message: `No exact Cloudflare zone match for "${candidate}". For composite TLDs, set CLOUDFLARE_ZONE_ID or use --zone.`,
    });
  }
  return exactMatch.id;
}
