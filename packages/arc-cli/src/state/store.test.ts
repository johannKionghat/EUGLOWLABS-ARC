import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ArcState } from "./schema.js";
import { diffState, readState, writeState } from "./store.js";

describe("state store", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "arc-state-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("readState returns null when the file does not exist", async () => {
    const state = await readState(join(dir, "nope.json"));
    expect(state).toBeNull();
  });

  it("writeState then readState round-trips", async () => {
    const path = join(dir, "nested", "state.json");
    const state: ArcState = {
      schemaVersion: 1,
      project: "johann-stack",
      lastDeployAt: "2026-05-02T10:00:00.000Z",
      lastAdapter: "local",
      writtenPaths: ["/srv/arc/.env", "/srv/arc/docker-compose.prod.yml"],
      annotations: { commit: "abc123" },
    };
    await writeState(path, state);
    const round = await readState(path);
    expect(round).toEqual(state);
  });

  it("readState rejects an invalid JSON shape", async () => {
    const path = join(dir, "bad.json");
    await writeFile(path, JSON.stringify({ not: "a state" }), "utf8");
    await expect(readState(path)).rejects.toThrow();
  });

  it("diffState detects added, removed and identity changes", () => {
    const prev: ArcState = {
      schemaVersion: 1,
      project: "old",
      lastDeployAt: "2026-05-01T00:00:00.000Z",
      lastAdapter: "local",
      writtenPaths: ["/a", "/b"],
      annotations: {},
    };
    const next: ArcState = {
      schemaVersion: 1,
      project: "new",
      lastDeployAt: "2026-05-02T00:00:00.000Z",
      lastAdapter: "vps:1.2.3.4",
      writtenPaths: ["/b", "/c"],
      annotations: {},
    };
    expect(diffState(prev, next)).toEqual({
      pathsAdded: ["/c"],
      pathsRemoved: ["/a"],
      adapterChanged: true,
      projectChanged: true,
    });
  });

  it("diffState handles the prev=null first-deploy case", () => {
    const next: ArcState = {
      schemaVersion: 1,
      project: "p",
      lastDeployAt: "2026-05-02T00:00:00.000Z",
      lastAdapter: "local",
      writtenPaths: ["/x"],
      annotations: {},
    };
    expect(diffState(null, next)).toEqual({
      pathsAdded: ["/x"],
      pathsRemoved: [],
      adapterChanged: true,
      projectChanged: true,
    });
  });
});
