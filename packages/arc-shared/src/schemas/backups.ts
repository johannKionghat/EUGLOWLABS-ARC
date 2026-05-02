import { z } from "zod";

/**
 * Cron schedule pattern (5 fields: minute, hour, day-of-month, month, day-of-week).
 * Pragmatic regex — accepts numbers, lists, ranges, steps and `*`. Not a full
 * RFC-correct cron parser; the orchestrator (cron daemon) is the authoritative
 * validator at runtime.
 */
const CRON_REGEX = /^(\*|[\d,\-*/]+)(\s+(\*|[\d,\-*/]+)){4}$/;

/**
 * Backup configuration.
 *
 * Local snapshots are taken even without a remote target. Remote upload
 * (Cloudflare R2 today) is configured via `remote`.
 *
 * See spec-infra §12 (Backup & Restauration).
 *
 * Boundary type: keys mirror the YAML config 1:1 (snake_case).
 */
export const backupsSchema = z.object({
  enabled: z.boolean().default(true),
  schedule: z
    .string()
    .regex(CRON_REGEX, "backups.schedule must be a 5-field cron expression")
    .default("0 2 * * *"),
  retention_days: z
    .number()
    .int()
    .positive()
    .max(365, "backups.retention_days cannot exceed 365")
    .default(7),
  remote: z
    .object({
      provider: z.literal("r2"),
      bucket: z.string().min(1, "backups.remote.bucket is required"),
    })
    .optional(),
});

export type BackupsConfig = z.infer<typeof backupsSchema>;
