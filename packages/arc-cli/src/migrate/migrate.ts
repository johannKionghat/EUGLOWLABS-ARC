import type { ArcConfig } from "@euglowlabs/arc-shared";

import { restoreBackup } from "../backup/restore.js";
import { type BackupResult, runBackup } from "../backup/run.js";
import type { DeployResult } from "../deploy/deploy.js";
import { deploy } from "../deploy/deploy.js";
import type { ExecutionAdapter } from "../exec/index.js";

export interface MigrateOptions {
  /** Adapter pointing at the source (typically a LocalAdapter). */
  source: ExecutionAdapter;
  /** Adapter pointing at the destination (typically a VPSAdapter). */
  target: ExecutionAdapter;
  /** Where backups land on the source. */
  sourceBackupDir: string;
  /** Where the destination expects the staging artifacts. */
  targetBackupDir: string;
  /** Compose / env destination on the target. */
  targetOutDir: string;
  /** Volumes to migrate, by name. */
  volumes?: string[];
  /** Optional logger. */
  log?: (line: string) => void;
}

export interface MigrateResult {
  backup: BackupResult;
  deploy: DeployResult;
  restoreExitCodes: number[];
}

/**
 * Migrate a project from one adapter to another.
 *
 * 1. Take a backup on the source.
 * 2. copyFile each artifact onto the target's filesystem.
 * 3. Run `arc deploy` on the target via the supplied config.
 * 4. Restore each artifact through the target adapter.
 *
 * Skips anything that does not exit cleanly — non-zero codes show up
 * in the result so the caller can decide whether to roll back.
 */
export async function migrate(cfg: ArcConfig, opts: MigrateOptions): Promise<MigrateResult> {
  const log = opts.log ?? (() => {});
  log(`Backup on ${opts.source.describe()}`);
  const backup = await runBackup(opts.source, {
    outDir: opts.sourceBackupDir,
    volumes: opts.volumes,
  });

  log(`Uploading ${backup.artifacts.length} artifacts to ${opts.target.describe()}`);
  for (const artifact of backup.artifacts) {
    const filename = artifact.path.split("/").pop() ?? "";
    const dest = `${opts.targetBackupDir}/${filename}`;
    await opts.target.copyFile(artifact.path, dest);
  }

  log(`Deploying stack on ${opts.target.describe()}`);
  const deployResult = await deploy(cfg, opts.target, {
    outDir: opts.targetOutDir,
    skipCompose: false,
    log,
  });

  log("Restoring data on target");
  const restoreExitCodes: number[] = [];
  for (const artifact of backup.artifacts) {
    const filename = artifact.path.split("/").pop() ?? "";
    const targetPath = `${opts.targetBackupDir}/${filename}`;
    if (artifact.kind === "postgres") {
      const r = await restoreBackup(opts.target, { path: targetPath });
      restoreExitCodes.push(r.exitCode);
    } else if (artifact.kind === "volume") {
      const volume = filename.replace(/^volume_/, "").replace(/_[^_]+\.tar\.gz$/, "");
      const r = await restoreBackup(opts.target, {
        path: targetPath,
        targetVolume: volume,
      });
      restoreExitCodes.push(r.exitCode);
    }
  }

  return { backup, deploy: deployResult, restoreExitCodes };
}
