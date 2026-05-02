import type { ExecutionAdapter } from "../exec/index.js";

export interface RunBackupOptions {
  /** Directory on the adapter where backup files are written. */
  outDir: string;
  /** Postgres container name. Default: "postgres". */
  postgresContainer?: string;
  /** Postgres role used by `pg_dumpall`. Default: "postgres". */
  postgresUser?: string;
  /** Named docker volumes to snapshot via tarball. */
  volumes?: string[];
  /** Override the timestamp in file names (mainly for tests). */
  now?: () => Date;
}

export interface BackupArtifact {
  kind: "postgres" | "volume";
  path: string;
  exitCode: number;
}

export interface BackupResult {
  artifacts: BackupArtifact[];
  startedAt: string;
}

function isoStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
}

/**
 * Take a snapshot of the project's data through the adapter.
 *
 * - Postgres: `pg_dumpall` against the configured container.
 * - Named volumes: tarball via a throw-away alpine container that
 *   mounts the volume read-only and pipes to a file in `outDir`.
 *
 * Each artifact is reported in the result; non-zero exit codes are
 * surfaced rather than thrown so that the caller can decide how to
 * fail (e.g. continue with other artifacts when one volume errors).
 */
export async function runBackup(
  adapter: ExecutionAdapter,
  opts: RunBackupOptions,
): Promise<BackupResult> {
  const date = (opts.now ?? (() => new Date()))();
  const stamp = isoStamp(date);
  const postgresContainer = opts.postgresContainer ?? "postgres";
  const postgresUser = opts.postgresUser ?? "postgres";
  const volumes = opts.volumes ?? [];

  const artifacts: BackupArtifact[] = [];

  await adapter.exec(`mkdir -p ${opts.outDir}`);

  const dumpPath = `${opts.outDir}/db_${stamp}.sql`;
  const dumpCmd = `docker exec ${postgresContainer} pg_dumpall -U ${postgresUser} > ${dumpPath}`;
  const dumpResult = await adapter.exec(dumpCmd);
  artifacts.push({ kind: "postgres", path: dumpPath, exitCode: dumpResult.exitCode });

  for (const volume of volumes) {
    const volPath = `${opts.outDir}/volume_${volume}_${stamp}.tar.gz`;
    const cmd = `docker run --rm -v ${volume}:/data:ro alpine tar -czf - -C /data . > ${volPath}`;
    const r = await adapter.exec(cmd);
    artifacts.push({ kind: "volume", path: volPath, exitCode: r.exitCode });
  }

  return { artifacts, startedAt: date.toISOString() };
}
