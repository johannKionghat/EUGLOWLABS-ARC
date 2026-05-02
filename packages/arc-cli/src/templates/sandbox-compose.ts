import type { ArcConfig } from "@euglowlabs/arc-shared";

import { renderTemplate } from "./render.js";

/**
 * Render the sandbox `docker-compose.yml`.
 *
 * Implements the network-isolation contract of ADR-0008: `sandbox_net`
 * is `internal: true` (no internet, no cross-network access) and
 * `code-executor` is hardened with `read_only`, `cap_drop: [ALL]`,
 * `no-new-privileges`, plus memory and CPU limits. See spec-infra
 * §11.2 and §19.
 *
 * Removing `internal: true` from the generated file would break the
 * security boundary: do not edit the rendered compose by hand.
 */
export function generateSandboxCompose(cfg: ArcConfig): string {
  return renderTemplate("docker-compose.sandbox.yml.eta", { cfg });
}
