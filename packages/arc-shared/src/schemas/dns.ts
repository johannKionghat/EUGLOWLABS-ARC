import { z } from "zod";

/**
 * DNS configuration. Cloudflare-only at this stage.
 *
 * Used by `arc setup` to create A records (wildcard `*.<domain>`)
 * pointing at the public IP of the host machine.
 *
 * See spec-infra §10 (DNS) and ADR-0012 (single-machine install).
 *
 * Boundary type: keys mirror the YAML config 1:1 (snake_case).
 */
export const dnsSchema = z.object({
  provider: z.literal("cloudflare"),
  zone: z.string().min(1, "dns.zone is required"),
  api_token: z.string().min(1, "dns.api_token is required"),
});

export type DnsConfig = z.infer<typeof dnsSchema>;
