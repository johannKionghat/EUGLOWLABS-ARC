import type { ExecutionAdapter } from "../exec/index.js";

export interface UploadToR2Options {
  /** Local path to upload (file or directory). */
  source: string;
  /** rclone remote name configured in `~/.config/rclone/rclone.conf`. */
  remote: string;
  /** Bucket name. */
  bucket: string;
  /** Optional sub-path inside the bucket. */
  prefix?: string;
  /** Stream callback per rclone output line. */
  onLine?: (line: string) => void;
}

/**
 * Upload a backup artifact (file or directory) to a Cloudflare R2
 * bucket via `rclone copy`.
 *
 * Assumes `rclone` is installed and that `<remote>` is configured to
 * point at the user's R2 account. Configuration of rclone itself is
 * out of scope for this command — see spec-infra §12.
 */
export async function uploadToR2(
  adapter: ExecutionAdapter,
  opts: UploadToR2Options,
): Promise<{ exitCode: number }> {
  const target = `${opts.remote}:${opts.bucket}${opts.prefix ? `/${opts.prefix}` : ""}`;
  const cmd = `rclone copy ${opts.source} ${target} --progress`;
  let buffer = "";
  const result = await adapter.exec(cmd, {
    onChunk: opts.onLine
      ? (chunk) => {
          buffer += chunk.data;
          let nl = buffer.indexOf("\n");
          while (nl !== -1) {
            opts.onLine?.(buffer.slice(0, nl));
            buffer = buffer.slice(nl + 1);
            nl = buffer.indexOf("\n");
          }
        }
      : undefined,
  });
  if (buffer.length > 0 && opts.onLine !== undefined) opts.onLine(buffer);
  return { exitCode: result.exitCode };
}
