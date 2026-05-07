import { z } from "zod";

/**
 * Cloudflare API v4 response wrapper. Every successful body has shape:
 *   { success: true, errors: [], messages: [...], result: <T> }
 * Every error body has shape:
 *   { success: false, errors: [{ code, message }, ...], messages: [], result: null }
 *
 * NB: response schemas are intentionally NOT `.strict()` — Cloudflare adds fields
 * over time (e.g., `meta`, `auto_added`, `proxiable`). We don't want to break on
 * unknown fields. Input schemas (CreateDnsRecord) ARE strict — we control input.
 */

export const CloudflareErrorShapeSchema = z.object({
  code: z.number(),
  message: z.string(),
});

export const CloudflareApiResponseSchema = z.object({
  success: z.boolean(),
  errors: z.array(CloudflareErrorShapeSchema),
  messages: z.array(z.unknown()),
  result: z.unknown(),
});

export type CloudflareApiResponse = z.infer<typeof CloudflareApiResponseSchema>;

export const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
});
export type Zone = z.infer<typeof ZoneSchema>;

export const DnsRecordTypeSchema = z.enum(["A", "CNAME", "TXT"]);
export type DnsRecordType = z.infer<typeof DnsRecordTypeSchema>;

export const DnsRecordSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  content: z.string(),
  ttl: z.number(),
  proxied: z.boolean().optional(),
  comment: z.string().nullable().optional(),
  zone_id: z.string().optional(),
  zone_name: z.string().optional(),
});
export type DnsRecord = z.infer<typeof DnsRecordSchema>;

/**
 * Input schema for createDnsRecord. Strict — we control this shape and want
 * fail-fast on typos / extra fields.
 */
export const CreateDnsRecordSchema = z
  .object({
    type: DnsRecordTypeSchema,
    name: z.string(),
    content: z.string(),
    ttl: z.number().optional(),
    proxied: z.boolean().optional(),
    comment: z.string().optional(),
  })
  .strict();
export type CreateDnsRecord = z.infer<typeof CreateDnsRecordSchema>;
