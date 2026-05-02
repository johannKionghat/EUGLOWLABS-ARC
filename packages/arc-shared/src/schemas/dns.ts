import { z } from "zod";

/**
 * DNS configuration. Cloudflare-only at this stage.
 *
 * `tunnel: true` is the default in `target: "local"` (Cloudflare Tunnel
 * provides public HTTPS without port forwarding) and remains permitted
 * in `target: "vps"` for advanced setups.
 *
 * See spec-infra §10 (DNS) and §6.1 (dual target).
 *
 * Boundary type: keys mirror the YAML config 1:1 (snake_case).
 */
export const dnsSchema = z.object({
  provider: z.literal("cloudflare"),
  zone: z.string().min(1, "dns.zone is required"),
  api_token: z.string().min(1, "dns.api_token is required"),
  tunnel: z.boolean().default(false),
});

export type DnsConfig = z.infer<typeof dnsSchema>;
