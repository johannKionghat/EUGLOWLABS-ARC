import { z } from "zod";

/**
 * Cloud provider for the VPS that hosts the ARC stack.
 *
 * Required when `target: "vps"`, ignored when `target: "local"`.
 * See spec-infra §5.5 (`arc.config.yml`).
 *
 * Boundary type: keys mirror the YAML config 1:1 (snake_case).
 */
export const providerSchema = z.object({
  name: z.literal("hetzner"),
  plan: z.string().min(1, "provider.plan is required"),
  location: z.string().min(1, "provider.location is required"),
  ssh_key: z.string().min(1, "provider.ssh_key path is required"),
});

export type Provider = z.infer<typeof providerSchema>;
