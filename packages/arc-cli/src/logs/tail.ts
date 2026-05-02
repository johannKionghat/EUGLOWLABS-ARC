import type { ExecutionAdapter } from "../exec/index.js";

export interface TailLogsOptions {
  /** Number of historical lines to print before streaming. Default 100. */
  tail?: number;
  /** Follow new output (docker logs -f). Default true. */
  follow?: boolean;
  /** Per-line stream callback. */
  onLine?: (line: string) => void;
}

/**
 * Tail logs of a single docker compose service through the adapter.
 *
 * Buffers chunks and emits one `onLine` callback per newline. Falls
 * back to printing the trailing partial line at process end (when the
 * adapter resolves), so users see the last unterminated line too.
 */
export async function tailLogs(
  adapter: ExecutionAdapter,
  service: string,
  opts: TailLogsOptions = {},
): Promise<{ exitCode: number }> {
  const tail = opts.tail ?? 100;
  const follow = opts.follow ?? true;
  const cmd = `docker logs --tail ${tail}${follow ? " --follow" : ""} ${service}`;

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
  if (buffer.length > 0 && opts.onLine !== undefined) {
    opts.onLine(buffer);
  }
  return { exitCode: result.exitCode };
}
