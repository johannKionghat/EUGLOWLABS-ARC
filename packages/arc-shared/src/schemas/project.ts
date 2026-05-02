import { z } from "zod";

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/;

/**
 * A user-managed project deployed on the ARC stack via Coolify.
 *
 * `name` and `subdomain` are slugs (lowercase, digits, hyphens). `repo`
 * is the GitHub source path (e.g. `github.com/johann/euglow`). `branch`
 * defaults to `main`.
 *
 * See spec-infra §5.5.
 *
 * Boundary type: keys mirror the YAML config 1:1 (snake_case).
 */
export const projectEntrySchema = z.object({
  name: z.string().regex(SLUG_REGEX, "project.name must be a lowercase slug"),
  repo: z.string().min(1, "project.repo is required"),
  subdomain: z.string().regex(SLUG_REGEX, "project.subdomain must be a lowercase slug"),
  branch: z.string().min(1).default("main"),
});

export type ProjectEntry = z.infer<typeof projectEntrySchema>;
