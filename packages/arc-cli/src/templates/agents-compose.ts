import type { ArcConfig } from "@euglowlabs/arc-shared";

import { renderTemplate } from "./render.js";

/**
 * Render the agents `docker-compose.yml`.
 *
 * Adds OpenClaw (AI gateway) and DeepAgents on top of
 * `local-ai-packaged`. Both are reachable on `ai_net`; DeepAgents is
 * additionally attached to `sandbox_net` — the documented junction
 * point of ADR-0008 — so it can run agent-generated code inside the
 * isolated sandbox via `docker exec`.
 *
 * Both networks are referenced as `external: true`: `ai_net` is
 * created by `local-ai-packaged`, `sandbox_net` by the compose
 * generated in CLI-007. `arc deploy` (CLI-012) is responsible for
 * the bring-up order. See spec-infra §20.
 */
export function generateAgentsCompose(cfg: ArcConfig): string {
  return renderTemplate("docker-compose.agents.yml.eta", { cfg });
}
