// Copy non-TS template assets from src/ to dist/ after `tsc` runs.
// Cross-platform via node:fs.promises.cp.
import { cp } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");

const src = resolve(pkgRoot, "src/templates/__templates__");
const dest = resolve(pkgRoot, "dist/templates/__templates__");

await cp(src, dest, { recursive: true });
console.info(`copied ${src} -> ${dest}`);
