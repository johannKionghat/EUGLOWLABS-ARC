import { Eta } from "eta";

import { TEMPLATES_MANIFEST } from "../templates-manifest.js";

// Eta is configured without `views` since templates are no longer
// resolved on the host filesystem — they live in TEMPLATES_MANIFEST,
// embedded at codegen time by scripts/generate-templates-manifest.mjs
// and bundled into the binary by `bun build --compile` (CLI-031, same
// pattern as DIST-001 1a-2 for Ansible playbooks).
const eta = new Eta({ autoEscape: false });

/**
 * Render an `.eta` template from the embedded manifest.
 *
 * The template name is the file's basename (e.g.
 * `"docker-compose.prod.yml.eta"`). Data is passed under the `it`
 * binding inside the template, per Eta convention.
 *
 * Throws an explicit Error if the name is not in the manifest, rather
 * than the cryptic ENOENT one would get from a missing filesystem path
 * under `/$bunfs/root/...` in the compiled binary.
 */
export function renderTemplate(name: string, data: Record<string, unknown>): string {
  const source = TEMPLATES_MANIFEST[name];
  if (source === undefined) {
    const available = Object.keys(TEMPLATES_MANIFEST).join(", ");
    throw new Error(
      `Template not found in manifest: ${JSON.stringify(name)}. Available: ${available}`,
    );
  }
  return eta.renderString(source, data);
}
