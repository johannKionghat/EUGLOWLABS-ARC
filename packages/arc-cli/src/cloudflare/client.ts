import { z } from "zod";

import {
  CloudflareApiError,
  type CloudflareApiErrorArgs,
  CloudflareAuthError,
  CloudflareNotFoundError,
  CloudflareRateLimitError,
  CloudflareValidationError,
} from "./errors";
import {
  CloudflareApiResponseSchema,
  type CreateDnsRecord,
  type DnsRecord,
  DnsRecordSchema,
  type Zone,
  ZoneSchema,
} from "./types";

const DEFAULT_BASE_URL = "https://api.cloudflare.com/client/v4";

export interface CloudflareClientOptions {
  /** Cloudflare API token with `Zone:DNS:Edit` scope minimum. */
  apiToken: string;
  /**
   * Override base URL. Useful for tests, enterprise proxy, or staging.
   * Falls back to `process.env.CLOUDFLARE_API_BASE_URL`, then to the public
   * Cloudflare API endpoint.
   */
  baseUrl?: string;
}

/**
 * Tiny client for Cloudflare API v4.
 *
 * Covers the 4 endpoints the `arc dns *` commands need:
 *   - listZones (GET /zones)
 *   - listDnsRecords (GET /zones/:id/dns_records)
 *   - createDnsRecord (POST /zones/:id/dns_records)
 *   - deleteDnsRecord (DELETE /zones/:id/dns_records/:record_id)
 *
 * Auth: Bearer token (modern API, not the legacy email + key pair).
 *
 * Errors: HTTP status codes are mapped to typed subclasses of
 * CloudflareApiError. See errors.ts for the hierarchy.
 */
export class CloudflareClient {
  private readonly apiToken: string;
  private readonly baseUrl: string;

  constructor(opts: CloudflareClientOptions) {
    this.apiToken = opts.apiToken;
    this.baseUrl = opts.baseUrl ?? process.env.CLOUDFLARE_API_BASE_URL ?? DEFAULT_BASE_URL;
  }

  async listZones(name?: string): Promise<Zone[]> {
    const url = new URL(`${this.baseUrl}/zones`);
    if (name) url.searchParams.set("name", name);
    const data = await this.request(url, { method: "GET" });
    return z.array(ZoneSchema).parse(data);
  }

  async listDnsRecords(
    zoneId: string,
    filters?: { name?: string; type?: string },
  ): Promise<DnsRecord[]> {
    const url = new URL(`${this.baseUrl}/zones/${zoneId}/dns_records`);
    if (filters?.name) url.searchParams.set("name", filters.name);
    if (filters?.type) url.searchParams.set("type", filters.type);
    const data = await this.request(url, { method: "GET" });
    return z.array(DnsRecordSchema).parse(data);
  }

  async createDnsRecord(zoneId: string, record: CreateDnsRecord): Promise<DnsRecord> {
    const url = new URL(`${this.baseUrl}/zones/${zoneId}/dns_records`);
    const data = await this.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    return DnsRecordSchema.parse(data);
  }

  async deleteDnsRecord(zoneId: string, recordId: string): Promise<void> {
    const url = new URL(`${this.baseUrl}/zones/${zoneId}/dns_records/${recordId}`);
    await this.request(url, { method: "DELETE" });
  }

  /**
   * Common HTTP path for all 4 methods:
   *  1. fetch with auth header (network error → wrapped CloudflareApiError)
   *  2. parse JSON body (non-JSON → wrapped CloudflareApiError)
   *  3. validate envelope shape via Zod
   *  4. if envelope.success === false, map HTTP status to typed error subclass
   *  5. return envelope.result (caller is responsible for parsing it)
   */
  private async request(url: URL, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          ...init.headers,
        },
      });
    } catch (cause) {
      throw new CloudflareApiError({
        status: 0,
        message: `Network error calling Cloudflare API at ${url.pathname}: ${(cause as Error).message}`,
        cause,
      });
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      throw new CloudflareApiError({
        status: response.status,
        message: `Cloudflare API returned non-JSON response (${response.status}) at ${url.pathname}`,
        cause,
      });
    }

    const parsed = CloudflareApiResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new CloudflareApiError({
        status: response.status,
        message: `Cloudflare API returned unexpected shape at ${url.pathname}`,
        cause: parsed.error,
      });
    }

    if (!parsed.data.success) {
      const cfError = parsed.data.errors[0];
      const args: CloudflareApiErrorArgs = {
        status: response.status,
        code: cfError?.code,
        message:
          cfError?.message ?? `Cloudflare API call failed (${response.status}) at ${url.pathname}`,
      };
      if (response.status === 401 || response.status === 403) {
        throw new CloudflareAuthError(args);
      }
      if (response.status === 404) {
        throw new CloudflareNotFoundError(args);
      }
      if (response.status === 429) {
        throw new CloudflareRateLimitError(args);
      }
      if (response.status === 400) {
        throw new CloudflareValidationError(args);
      }
      throw new CloudflareApiError(args);
    }

    return parsed.data.result;
  }
}
