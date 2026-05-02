import { z } from "zod";

import { backupsSchema } from "./backups.js";
import { dnsSchema } from "./dns.js";
import { projectEntrySchema } from "./project.js";
import { providerSchema } from "./provider.js";
import { servicesSchema } from "./services.js";
import { stackSchema } from "./stack.js";

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/;
const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

/**
 * Root schema for `arc.config.yml`.
 *
 * Single source of truth for the user-facing configuration that drives
 * the `arc` CLI (`init`, `deploy`, `status`, `backup`, `migrate`, ...).
 * Consumed by ARC Agent and ARC Cloud as well — that's why it lives in
 * `@euglowlabs/arc-shared` (see ADR-0001).
 *
 * See spec-infra §5.5 and ADR-0009 (dual target local/VPS).
 *
 * Boundary type: keys mirror the YAML config 1:1 (snake_case). The schema
 * is `.strict()` to surface typos in the user's config rather than
 * silently dropping unknown keys.
 */
export const arcConfigSchema = z
  .strictObject({
    project: z.string().regex(SLUG_REGEX, "project must be a lowercase slug"),
    target: z.enum(["local", "vps"]),
    domain: z.string().regex(DOMAIN_REGEX, "domain must be a valid hostname"),
    email: z.email("email must be a valid email address"),
    provider: providerSchema.optional(),
    dns: dnsSchema,
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
    if (cfg.target === "vps" && !cfg.provider) {
      ctx.addIssue({
        code: "custom",
        path: ["provider"],
        message: 'provider is required when target is "vps"',
      });
    }

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
