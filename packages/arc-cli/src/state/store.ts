import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { type ArcState, stateSchema } from "./schema.js";

interface NodeError extends Error {
  code?: string;
}

/**
 * Read `.infra/state.json` from disk. Returns `null` if the file does
 * not exist (first deploy). Throws if the file exists but is not a
 * valid `ArcState`.
 */
export async function readState(path: string): Promise<ArcState | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (cause) {
    if ((cause as NodeError).code === "ENOENT") return null;
    throw cause;
  }
  return stateSchema.parse(JSON.parse(raw));
}

/**
 * Write `.infra/state.json`. Creates the directory tree as needed.
 */
export async function writeState(path: string, state: ArcState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const validated = stateSchema.parse(state);
  await writeFile(path, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
}

export interface StateDiff {
  pathsAdded: string[];
  pathsRemoved: string[];
  adapterChanged: boolean;
  projectChanged: boolean;
}

/**
 * Compute the diff between two snapshots. Used by `arc status` to
 * surface drift between the stored state and the desired config.
 */
export function diffState(prev: ArcState | null, next: ArcState): StateDiff {
  if (prev === null) {
    return {
      pathsAdded: [...next.writtenPaths],
      pathsRemoved: [],
      adapterChanged: true,
      projectChanged: true,
    };
  }
  const prevSet = new Set(prev.writtenPaths);
  const nextSet = new Set(next.writtenPaths);
  return {
    pathsAdded: next.writtenPaths.filter((p) => !prevSet.has(p)),
    pathsRemoved: prev.writtenPaths.filter((p) => !nextSet.has(p)),
    adapterChanged: prev.lastAdapter !== next.lastAdapter,
    projectChanged: prev.project !== next.project,
  };
}
