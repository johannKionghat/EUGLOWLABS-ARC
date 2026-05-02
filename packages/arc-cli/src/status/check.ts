import type { ExecutionAdapter } from "../exec/index.js";

export interface ServiceStatus {
  name: string;
  state: string;
}

export interface StatusReport {
  adapter: string;
  services: ServiceStatus[];
  raw: string;
  exitCode: number;
}

/**
 * Run `docker compose ps --format json` through the adapter and parse
 * the result into a structured report.
 *
 * Compose's `--format json` emits one JSON object per line, so we
 * parse line-by-line and skip blank lines. A non-zero exit code is
 * returned in the report rather than thrown — callers decide how to
 * surface the failure.
 */
export async function checkStatus(adapter: ExecutionAdapter): Promise<StatusReport> {
  const result = await adapter.exec("docker compose ps --format json");
  const services: ServiceStatus[] = [];
  for (const line of result.stdout.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      const parsed = JSON.parse(trimmed) as {
        Name?: string;
        Service?: string;
        State?: string;
      };
      services.push({
        name: parsed.Name ?? parsed.Service ?? "(unknown)",
        state: parsed.State ?? "(unknown)",
      });
    } catch {
      // Not JSON — ignore. Compose may emit headers when not in --format json.
    }
  }
  return {
    adapter: adapter.describe(),
    services,
    raw: result.stdout,
    exitCode: result.exitCode,
  };
}
