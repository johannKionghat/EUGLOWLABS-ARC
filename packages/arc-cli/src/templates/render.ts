import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Eta } from "eta";

const here = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(here, "__templates__");

const eta = new Eta({ views: templatesDir, autoEscape: false });

/**
 * Render an `.eta` template located in `src/templates/__templates__/`.
 *
 * The template name is the file's basename (e.g.
 * `"docker-compose.prod.yml.eta"`). Data is passed under the `it`
 * binding inside the template, per Eta convention.
 */
export function renderTemplate(name: string, data: Record<string, unknown>): string {
  const path = resolve(templatesDir, name);
  const source = readFileSync(path, "utf8");
  return eta.renderString(source, data);
}
