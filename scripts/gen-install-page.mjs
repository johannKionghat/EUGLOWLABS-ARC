#!/usr/bin/env node
// Mirror packages/arc-cli/install.sh -> dist/install/index.html so Cloudflare
// Pages can serve it at https://install-arc.euglowlabs.com (DIST-001 1d).
//
// Cloudflare Pages auto-serves index.html on /. The colocated _headers file
// overrides Content-Type to text/plain so `curl | sh` receives a sh script,
// not a HTML page. See dist/install/_headers.
//
// Run via `pnpm gen:install-page` (root script). Idempotent.

import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const src = resolve(repoRoot, "packages/arc-cli/install.sh");
const outDir = resolve(repoRoot, "dist/install");
const out = resolve(outDir, "index.html");

const content = readFileSync(src, "utf-8");
mkdirSync(outDir, { recursive: true, mode: 0o755 });
writeFileSync(out, content, { encoding: "utf-8", mode: 0o644 });

const bytes = statSync(out).size;
console.info(`✓ ${out} (${bytes} bytes) <- ${src}`);
