import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

interface NodeError extends Error {
  code?: string;
}

export interface TelemetrySettings {
  enabled: boolean;
}

const DEFAULT: TelemetrySettings = { enabled: false };

export function defaultTelemetryPath(): string {
  return join(homedir(), ".arc", "telemetry.json");
}

/**
 * Read the user's telemetry preference. Returns `{ enabled: false }`
 * (opt-in default) when the file does not exist.
 */
export async function readTelemetry(
  path: string = defaultTelemetryPath(),
): Promise<TelemetrySettings> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<TelemetrySettings>;
    return { enabled: parsed.enabled === true };
  } catch (cause) {
    if ((cause as NodeError).code === "ENOENT") return { ...DEFAULT };
    throw cause;
  }
}

export async function writeTelemetry(
  settings: TelemetrySettings,
  path: string = defaultTelemetryPath(),
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}
