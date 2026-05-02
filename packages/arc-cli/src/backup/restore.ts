import type { ExecutionAdapter } from "../exec/index.js";

export interface ListBackupsOptions {
  /** Directory on the adapter where snapshots live. */
  dir: string;
}

export interface BackupEntry {
  path: string;
  kind: "postgres" | "volume" | "unknown";
}

/**
 * List the backups present on the adapter under `dir`.
 *
 * Recognised file names follow the convention `db_<stamp>.sql` and
 * `volume_<name>_<stamp>.tar.gz` produced by {@link runBackup}.
 */
export async function listBackups(
  adapter: ExecutionAdapter,
  opts: ListBackupsOptions,
): Promise<BackupEntry[]> {
  const result = await adapter.exec(`ls -1 ${opts.dir}`);
  if (result.exitCode !== 0) return [];
  const entries: BackupEntry[] = [];
  for (const line of result.stdout.split("\n")) {
    const name = line.trim();
    if (name.length === 0) continue;
    const fullPath = `${opts.dir}/${name}`;
    if (name.startsWith("db_") && name.endsWith(".sql")) {
      entries.push({ path: fullPath, kind: "postgres" });
    } else if (name.startsWith("volume_") && name.endsWith(".tar.gz")) {
      entries.push({ path: fullPath, kind: "volume" });
    } else {
      entries.push({ path: fullPath, kind: "unknown" });
    }
  }
  return entries;
}

export interface RestoreBackupOptions {
  /** Backup file path on the adapter (file produced by listBackups). */
  path: string;
  /** Postgres container name. Default: "postgres". */
  postgresContainer?: string;
  /** Postgres role used for psql restore. Default: "postgres". */
  postgresUser?: string;
  /** Volume to restore into when path points at a volume_*.tar.gz. */
  targetVolume?: string;
}

/**
 * Restore a single backup artifact through the adapter.
 *
 * - Postgres dumps: piped into `psql` running inside the container.
 * - Volume tarballs: extracted into the named volume via a throw-away
 *   alpine container that mounts the volume and reads from stdin.
 */
export async function restoreBackup(
  adapter: ExecutionAdapter,
  opts: RestoreBackupOptions,
): Promise<{ exitCode: number }> {
  const postgresContainer = opts.postgresContainer ?? "postgres";
  const postgresUser = opts.postgresUser ?? "postgres";

  if (opts.path.endsWith(".sql")) {
    const cmd = `cat ${opts.path} | docker exec -i ${postgresContainer} psql -U ${postgresUser}`;
    const result = await adapter.exec(cmd);
    return { exitCode: result.exitCode };
  }

  if (opts.path.endsWith(".tar.gz")) {
    if (opts.targetVolume === undefined) {
      throw new Error("restoreBackup: targetVolume is required for volume backups");
    }
    const cmd = `cat ${opts.path} | docker run --rm -i -v ${opts.targetVolume}:/data alpine tar -xzf - -C /data`;
    const result = await adapter.exec(cmd);
    return { exitCode: result.exitCode };
  }

  throw new Error(`restoreBackup: unsupported file extension for ${opts.path}`);
}
