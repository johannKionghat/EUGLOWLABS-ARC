import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readTelemetry, writeTelemetry } from "./store.js";

describe("telemetry store", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "arc-tel-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("readTelemetry returns { enabled: false } when the file is missing", async () => {
    const settings = await readTelemetry(join(dir, "missing.json"));
    expect(settings.enabled).toBe(false);
  });

  it("write then read round-trips", async () => {
    const path = join(dir, "tel.json");
    await writeTelemetry({ enabled: true }, path);
    const settings = await readTelemetry(path);
    expect(settings.enabled).toBe(true);
  });

  it("malformed enabled values are coerced to false", async () => {
    const path = join(dir, "tel.json");
    await writeTelemetry({ enabled: false }, path);
    const settings = await readTelemetry(path);
    expect(settings.enabled).toBe(false);
  });
});
