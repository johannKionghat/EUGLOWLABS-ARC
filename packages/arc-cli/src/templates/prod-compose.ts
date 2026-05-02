import type { ArcConfig } from "@euglowlabs/arc-shared";

import { renderTemplate } from "./render.js";

/**
 * Render the production `docker-compose.yml` for the project.
 *
 * Contains the services Coolify does NOT install on its own (Uptime
 * Kuma + monitoring), all attached to the `prod_net` network.
 * Apps under `cfg.projects[]` are NOT included — they are deployed
 * via Coolify Git push (cf. ADR-0005). See spec-infra §4.1 and §5.3.
 */
export function generateProdCompose(cfg: ArcConfig): string {
  return renderTemplate("docker-compose.prod.yml.eta", { cfg });
}
