import type { ArcConfig } from "@euglowlabs/arc-shared";

import { renderTemplate } from "./render.js";

/**
 * Render the `.env` file shared by every compose in the project.
 *
 * Carries the public-ish values derived from `arc.config.yml`
 * (`BASE_DOMAIN`, `ADMIN_EMAIL`, `CF_API_TOKEN`) and explicit
 * `__REPLACE_ME__` placeholders for `JWT_SECRET` and
 * `POSTGRES_PASSWORD`. Random secret generation is intentionally
 * deferred to a dedicated task. See spec-infra §5.3 and §11.4.
 */
export function generateEnvFile(cfg: ArcConfig): string {
  return renderTemplate("env.eta", { cfg });
}
