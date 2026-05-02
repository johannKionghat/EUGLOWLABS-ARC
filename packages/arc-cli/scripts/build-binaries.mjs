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
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const entry = resolve(pkgRoot, "src/index.ts");
const outDir = resolve(pkgRoot, "bin");

await mkdir(outDir, { recursive: true });

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
    ["build", "--compile", `--target=${target.flag}`, "--outfile", out, entry],
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
