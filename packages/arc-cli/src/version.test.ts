import { describe, expect, it } from "vitest";

import { BUILD_DATE, GIT_SHA, VERSION, formatVersion } from "./version.js";

/**
 * These tests cover the dev-fallback paths only. The real production
 * substitution by `bun build --define` is validated end-to-end at
 * DIST-001 1a-5 (smoke of the compiled binary) — it cannot be tested
 * from Vitest/Node because the substitution only happens inside
 * `bun build --compile`.
 */
describe("version metadata fallbacks (dev / Vitest path)", () => {
  it("VERSION falls back to '0.0.0-dev' when __ARC_VERSION__ is undefined", () => {
    expect(VERSION).toBe("0.0.0-dev");
  });

  it("GIT_SHA falls back to 'unknown' when __ARC_GIT_SHA__ is undefined", () => {
    expect(GIT_SHA).toBe("unknown");
  });

  it("BUILD_DATE falls back to 'dev' when __ARC_BUILD_DATE__ is undefined", () => {
    expect(BUILD_DATE).toBe("dev");
  });

  it("formatVersion renders the canonical 'X (sha=Y, built=Z)' string", () => {
    expect(formatVersion()).toBe("0.0.0-dev (sha=unknown, built=dev)");
  });
});
