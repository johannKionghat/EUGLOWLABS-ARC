// Cross-target single-binary build via `bun build --compile`.
// Run from packages/arc-cli/.
//
// Output goes to `bin/`:
//   - bin/arc-linux-x64
//   - bin/arc-linux-arm64
//   - bin/arc-darwin-x64
//   - bin/arc-darwin-arm64
//   - bin/arc-windows-x64.exe
//
// Bun must be installed and on PATH. Templates copied via the existing
// build pipeline are inlined by `bun build --compile` because the
// runtime resolver reads them at startup; the postbuild copy step
// remains for the tsc-only build path.
//
// DIST-001 1a-3 — Version metadata injection. Three constants are
// substituted at compile time via `bun build --define` :
//   - __ARC_VERSION__    ← package.json#version
//   - __ARC_GIT_SHA__    ← `git rev-parse --short HEAD` (fallback "unknown")
//   - __ARC_BUILD_DATE__ ← ISO 8601 UTC at build time
// See `src/version.ts` for the corresponding `declare const` block and
// the dev fallbacks.
import { execSync, spawnSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const entry = resolve(pkgRoot, "src/index.ts");
const outDir = resolve(pkgRoot, "bin");

await mkdir(outDir, { recursive: true });

const pkgJson = JSON.parse(await readFile(resolve(pkgRoot, "package.json"), "utf-8"));
const version = pkgJson.version ?? "0.0.0";
let gitSha = "unknown";
try {
  gitSha = execSync("git rev-parse --short HEAD", {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {
  // Not in a git repo or git unavailable → keep "unknown".
}
const buildDate = new Date().toISOString();
console.info(`Version metadata: ${version} (sha=${gitSha}, built=${buildDate})`);

const defineArgs = [
  "--define",
  `__ARC_VERSION__="${version}"`,
  "--define",
  `__ARC_GIT_SHA__="${gitSha}"`,
  "--define",
  `__ARC_BUILD_DATE__="${buildDate}"`,
];

const targets = [
  { suffix: "linux-x64", flag: "bun-linux-x64" },
  { suffix: "linux-arm64", flag: "bun-linux-arm64" },
  { suffix: "darwin-x64", flag: "bun-darwin-x64" },
  { suffix: "darwin-arm64", flag: "bun-darwin-arm64" },
  { suffix: "windows-x64.exe", flag: "bun-windows-x64" },
];

let failed = 0;
for (const target of targets) {
  const out = resolve(outDir, `arc-${target.suffix}`);
  console.info(`→ ${target.flag}`);
  const result = spawnSync(
    "bun",
    ["build", "--compile", `--target=${target.flag}`, ...defineArgs, "--outfile", out, entry],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    console.error(`✗ ${target.flag} failed (status=${result.status})`);
    failed += 1;
  } else {
    console.info(`✓ ${out}`);
  }
}

if (failed > 0) process.exit(1);
