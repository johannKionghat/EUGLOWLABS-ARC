import { z } from "zod";

/**
 * Local state stored at `.infra/state.json` next to the user's
 * `arc.config.yml`. Records what `arc deploy` last produced so that
 * later commands (status, diff, restart) can reason about drift.
 *
 * See spec-infra §5.3 (3-layer architecture, state layer).
 */
export const stateSchema = z.object({
  /** Schema version — bumped when the state shape changes. */
  schemaVersion: z.literal(1).default(1),
  /** `cfg.project` from the last successful deploy. */
  project: z.string(),
  /** ISO timestamp of the last successful deploy. */
  lastDeployAt: z.string(),
  /** Adapter description string at the time of the last deploy. */
  lastAdapter: z.string(),
  /** Absolute paths of the files written by the last deploy. */
  writtenPaths: z.array(z.string()).default([]),
  /** Free-form key/value annotations (extensible). */
  annotations: z.record(z.string(), z.string()).default({}),
});

export type ArcState = z.infer<typeof stateSchema>;
