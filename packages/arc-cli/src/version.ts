/**
 * Build-time version metadata for the EuglowLabs ARC CLI.
 *
 * The three `__ARC_*__` constants are substituted at compile time by
 * `bun build --define` (DIST-001 1a-3) — see
 * `packages/arc-cli/scripts/build-binaries.mjs`. In dev / Vitest /
 * `tsc --noEmit` runs, the substitution never happens and the `typeof`
 * guard falls back to the dev sentinels below.
 *
 * The `declare const` block is module-scoped (not global) ; only this
 * file resolves `__ARC_*__` identifiers — every other module imports
 * the resolved `VERSION` / `GIT_SHA` / `BUILD_DATE` constants.
 */

declare const __ARC_VERSION__: string | undefined;
declare const __ARC_GIT_SHA__: string | undefined;
declare const __ARC_BUILD_DATE__: string | undefined;

/** Semver of the bundled CLI. Falls back to `"0.0.0-dev"` in dev. */
export const VERSION: string =
  typeof __ARC_VERSION__ !== "undefined" ? __ARC_VERSION__ : "0.0.0-dev";

/** Short commit SHA. Falls back to `"unknown"` in dev. */
export const GIT_SHA: string = typeof __ARC_GIT_SHA__ !== "undefined" ? __ARC_GIT_SHA__ : "unknown";

/** ISO 8601 UTC of the build moment. Falls back to `"dev"` in dev. */
export const BUILD_DATE: string =
  typeof __ARC_BUILD_DATE__ !== "undefined" ? __ARC_BUILD_DATE__ : "dev";

/**
 * Canonical user-facing rendering, e.g. `0.1.0 (sha=abc123,
 * built=2026-05-08T12:34:56Z)`. Per ADR-0016 §1.
 */
export function formatVersion(): string {
  return `${VERSION} (sha=${GIT_SHA}, built=${BUILD_DATE})`;
}
