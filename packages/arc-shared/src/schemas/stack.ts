import { z } from "zod";

/**
 * High-level stack composition.
 *
 * `paas` selects the orchestrator (Coolify by default — see ADR-0005;
 * Dokploy supported as a lighter alternative).
 * `ai_stack` deploys the `local-ai-packaged` bundle (Ollama + Supabase + n8n + ...).
 * `sandbox` deploys the isolated execution sandbox (`sandbox_net`, see ADR-0008).
 *
 * See spec-infra §5.5 and ADR-0008.
 *
 * Boundary type: keys mirror the YAML config 1:1 (snake_case).
 */
export const stackSchema = z.object({
  paas: z.enum(["coolify", "dokploy"]).default("coolify"),
  ai_stack: z.boolean().default(true),
  sandbox: z.boolean().default(true),
  monitoring: z.literal("uptime-kuma").default("uptime-kuma"),
});

export type StackConfig = z.infer<typeof stackSchema>;
