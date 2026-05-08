import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Read-only access to the playbook tree shipped with the CLI.
 *
 * The MVP impl ({@link EmbeddedPlaybooksLoader}) reads from a manifest
 * compiled into the binary at build time (DIST-001 1a-1 spike — content
 * inlined as JSON-stringified strings, bundled into the binary by
 * `bun build --compile` at ~50 KB cost for the current 24-file tree).
 *
 * Future loaders (e.g. tarball+base64 extractor as a fallback per
 * ADR-0016 §2 plan B) implement the same interface so the apply layer
 * does not care which strategy is in play.
 */
export interface PlaybooksLoader {
  /** Inventory of relative paths embedded in the binary. Stable order. */
  listPlaybooks(): readonly string[];
  /**
   * Materialise the entire tree under `targetDir`. Creates `targetDir`
   * (and any nested parents) on demand. Idempotent — existing files are
   * overwritten ; re-running over a complete prior extraction is a
   * no-op semantically. Files are written with mode 0644 ; directories
   * with mode 0755.
   */
  extractToDisk(targetDir: string): Promise<void>;
}

/**
 * Loader backed by an in-memory `Record<relPath, content>` manifest.
 *
 * The production manifest lives in `./playbooks-manifest.ts` (codegen,
 * gitignored). Tests inject a fake manifest directly through the
 * constructor — they MUST NOT import the generated production manifest
 * to stay deterministic.
 */
export class EmbeddedPlaybooksLoader implements PlaybooksLoader {
  readonly #manifest: Readonly<Record<string, string>>;

  constructor(manifest: Readonly<Record<string, string>>) {
    this.#manifest = manifest;
  }

  listPlaybooks(): readonly string[] {
    return Object.keys(this.#manifest);
  }

  async extractToDisk(targetDir: string): Promise<void> {
    await mkdir(targetDir, { recursive: true, mode: 0o755 });
    for (const [rel, content] of Object.entries(this.#manifest)) {
      const full = join(targetDir, rel);
      await mkdir(dirname(full), { recursive: true, mode: 0o755 });
      await writeFile(full, content, { encoding: "utf-8", mode: 0o644 });
    }
  }
}
