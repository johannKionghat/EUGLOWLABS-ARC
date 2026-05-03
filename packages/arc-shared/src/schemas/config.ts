import { z } from "zod";

import { backupsSchema } from "./backups.js";
import { dnsSchema } from "./dns.js";
import { projectEntrySchema } from "./project.js";
import { servicesSchema } from "./services.js";
import { stackSchema } from "./stack.js";

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/;
const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

/**
 * Root schema for `arc.config.yml`.
 *
 * Single source of truth for the user-facing configuration that drives
 * the `arc` CLI (`init`, `setup`, `deploy`, `status`, `backup`, ...).
 * Consumed by ARC Agent (Phase 2) as well — that's why it lives in
 * `@euglowlabs/arc-shared` (see ADR-0001).
 *
 * See spec-infra §5.5 and ADR-0012 (single-machine install model).
 *
 * Boundary type: keys mirror the YAML config 1:1 (snake_case). The schema
 * is `.strict()` to surface typos in the user's config rather than
 * silently dropping unknown keys.
 *
 * `agent: { bind, port }` is the binding configuration for the ARC
 * Agent (Phase 2) — included now to avoid re-breaking the schema later.
 */
export const arcConfigSchema = z
  .strictObject({
    project: z.string().regex(SLUG_REGEX, "project must be a lowercase slug"),
    domain: z.string().regex(DOMAIN_REGEX, "domain must be a valid hostname"),
    email: z.email("email must be a valid email address"),
    dns: dnsSchema,
    agent: z
      .object({
        bind: z.string().default("127.0.0.1"),
        port: z.number().int().positive().max(65535).default(9999),
      })
      .default({ bind: "127.0.0.1", port: 9999 }),
    stack: stackSchema.default({
      paas: "coolify",
      ai_stack: true,
      sandbox: true,
      monitoring: "uptime-kuma",
    }),
    backups: backupsSchema.default({
      enabled: true,
      schedule: "0 2 * * *",
      retention_days: 7,
    }),
    services: servicesSchema.default({ ollama: { models: [] } }),
    projects: z.array(projectEntrySchema).default([]),
  })
  .superRefine((cfg, ctx) => {
    const seenSubdomains = new Set<string>();
    for (let i = 0; i < cfg.projects.length; i += 1) {
      const sub = cfg.projects[i]?.subdomain;
      if (sub === undefined) continue;
      if (seenSubdomains.has(sub)) {
        ctx.addIssue({
          code: "custom",
          path: ["projects", i, "subdomain"],
          message: `duplicate subdomain "${sub}" — each project must have a unique subdomain`,
        });
      }
      seenSubdomains.add(sub);
    }
  });

export type ArcConfig = z.infer<typeof arcConfigSchema>;
