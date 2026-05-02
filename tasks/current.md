# Tâche en cours : CLI-008 — Génération template `docker-compose.agents.yml` (OpenClaw + DeepAgents)

## Statut
🟡 En cours — démarrée le 2026-05-02

## Objectif
**Dernier compose maison** de la trilogie templates. À partir d'un `ArcConfig`, générer le compose qui ajoute la couche AI custom à `local-ai-packaged` : `openclaw` (AI gateway, port 3100) et `deepagents` (orchestration agents, port 3200), tous deux sur `ai_net`. `deepagents` joint en plus `sandbox_net` pour déclencher l'exécution de code généré (cf. ADR-0008 : seul point de jonction autorisé entre `ai_net` et `sandbox_net`). Reprend la spec infra §20.

## Critères d'acceptation
- [ ] Template eta `docker-compose.agents.yml.eta` versionné
- [ ] Compose déclare `ai_net` et `sandbox_net` comme `external: true` (créés par les autres composes)
- [ ] Service `openclaw` : image GHCR officielle, env `OLLAMA_BASE_URL`, `DEFAULT_MODEL`, `FALLBACK_MODEL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, label Traefik `openclaw.<domain>`, network `ai_net`
- [ ] Service `deepagents` : image officielle, env `LLM_PROVIDER=openclaw`, `OPENCLAW_URL`, `QDRANT_URL`, label Traefik `agents.<domain>`, networks `ai_net` + `sandbox_net`, `depends_on: [openclaw]`
- [ ] `.env.eta` étendu avec `OPENCLAW_DEFAULT_MODEL`, `OPENCLAW_FALLBACK_MODEL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (placeholders `__REPLACE_ME__`)
- [ ] Fonction `generateAgentsCompose(cfg): string` exportée depuis `@euglowlabs/arc-cli/templates`
- [ ] ≥ 4 tests Vitest : présence des 2 services, du double-réseau de `deepagents`, des labels Traefik avec le domaine, absence de placeholders eta
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` verts
- [ ] CI verte sur la PR
- [ ] PR mergée sur main

## Fichiers concernés (estimation)
- `packages/arc-cli/src/templates/__templates__/docker-compose.agents.yml.eta` (création)
- `packages/arc-cli/src/templates/__templates__/env.eta` (modif — 4 nouvelles vars)
- `packages/arc-cli/src/templates/agents-compose.ts` (création)
- `packages/arc-cli/src/templates/index.ts` (modif — export)
- `packages/arc-cli/src/templates/agents-compose.test.ts` (création — 4 tests)
- `packages/arc-cli/src/templates/env.test.ts` (modif — 4 nouvelles assertions)

## ADRs liés
- **ADR-0008** — Trois réseaux Docker isolés : `deepagents` est le seul service explicitement autorisé sur `ai_net` ET `sandbox_net` (point de jonction documenté pour déclencher l'exécution de code via `docker exec` côté sandbox)
- ADR-0001 — Monorepo Turborepo
- ADR-0002 — Bun runtime CLI / clipanion

## Conventions à respecter
- `docs/04-conventions/coding-style.md` — TS strict, JSDoc, kebab-case fichiers
- `docs/04-conventions/testing.md` — Vitest collocated, cas limites couverts
- `docs/04-conventions/naming.md` — branche `feat/CLI-008-agents-template`, scope `cli`

## Hors scope (NE PAS faire)
- Pas de **logique d'exécution** côté DeepAgents (juste la config de l'image upstream)
- Pas de **commande clipanion** (orchestration = CLI-012)
- Pas d'**écriture sur disque** — fonction pure string
- Pas de **gen aléatoire des API keys** OpenAI/Anthropic — placeholders explicites
- Pas de **modification des autres composes** (prod, sandbox)
- Pas de **provisioning du registry GHCR** — les images sont publiques, pas de login requis ici

## Plan d'implémentation

### Sous-tâche 1 : Template eta `docker-compose.agents.yml.eta`
- **Fichiers** : `src/templates/__templates__/docker-compose.agents.yml.eta`
- **Effort estimé** : 15 min
- **Détail** : Reprendre quasi-littéralement la spec-infra §20. Header de commentaire mentionnant `<%= it.cfg.project %>` + rappel ADR-0008 sur la double-attache de `deepagents`. Networks `ai_net` et `sandbox_net` marqués `external: true` (créés respectivement par `local-ai-packaged` et le compose sandbox de CLI-007). Labels Traefik avec `${BASE_DOMAIN}` (interpolé par Compose, pas par eta).

### Sous-tâche 2 : Étendre `env.eta` avec les vars OpenClaw / API keys
- **Fichiers** : `src/templates/__templates__/env.eta`, `src/templates/env.test.ts`
- **Effort estimé** : 5 min
- **Détail** : Bloc dédié OpenClaw / DeepAgents :
  ```
  # OpenClaw — AI gateway routing
  OPENCLAW_DEFAULT_MODEL=mistral:7b
  OPENCLAW_FALLBACK_MODEL=__REPLACE_ME__

  # External AI providers (used by OpenClaw fallback)
  OPENAI_API_KEY=__REPLACE_ME__
  ANTHROPIC_API_KEY=__REPLACE_ME__
  ```
  Le `OPENCLAW_DEFAULT_MODEL` a une valeur par défaut concrète (`mistral:7b`) parce qu'on sait quel modèle Ollama est généralement présent. Mettre à jour `env.test.ts` pour asserter ces 4 lignes.

### Sous-tâche 3 : Générateur `generateAgentsCompose` + barrel
- **Fichiers** : `src/templates/agents-compose.ts`, `src/templates/index.ts`
- **Effort estimé** : 10 min
- **Détail** : Fonction `generateAgentsCompose(cfg: ArcConfig): string` qui appelle `renderTemplate("docker-compose.agents.yml.eta", { cfg })`. JSDoc renvoyant à spec-infra §20 et ADR-0008. Ajout de l'export dans le barrel.

### Sous-tâche 4 : Tests Vitest
- **Fichiers** : `src/templates/agents-compose.test.ts`
- **Effort estimé** : 15 min
- **Détail** : 4 cas :
  1. Compose contient les services `openclaw` et `deepagents`, avec leurs images respectives
  2. `deepagents` est sur les **deux** réseaux `ai_net` et `sandbox_net` (point de jonction documenté ADR-0008)
  3. Labels Traefik utilisent le domaine du config (`openclaw.<domain>` et `agents.<domain>`)
  4. Aucun placeholder eta non résolu

### Sous-tâche 5 : Vérif + commit + PR
- **Fichiers** : aucun nouveau
- **Effort estimé** : 10 min
- **Détail** : Inclure les artefacts pendants de CLI-007. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Vérifier que le postbuild copie le nouveau `.eta` dans `dist/`. Branche `feat/CLI-008-agents-template`. Commit `feat(cli): generate openclaw and deepagents compose [CLI-008]`. Push, PR, attendre CI verte, merger.

## Scratchpad

### Décisions ouvertes — à valider avant de coder
- **`networks: external: true`** : les réseaux `ai_net` et `sandbox_net` sont déclarés comme externes parce qu'ils sont créés par d'autres composes (`local-ai-packaged` et notre `docker-compose.sandbox.yml`). C'est le pattern que `arc deploy` orchestrera : `up sandbox` d'abord, puis `up agents`. À documenter quand on écrira CLI-012.
- **`deepagents` sur `ai_net` + `sandbox_net`** : seul service avec cette double appartenance. C'est le **point de jonction documenté** d'ADR-0008. Le code généré par DeepAgents est exécuté côté `sandbox_net` (qui reste `internal: true`) via `docker exec` ; DeepAgents lui-même reste sur `ai_net` pour parler à OpenClaw + Qdrant.
- **`OPENCLAW_DEFAULT_MODEL=mistral:7b`** : valeur par défaut concrète. Mistral 7B est le modèle "polyvalent" listé en spec-infra §8.1 et installé par défaut par `local-ai-packaged`.
- **Pas d'`extra_hosts` ni de network alias** : OpenClaw atteint Ollama via `http://ollama:11434` qui résout dans `ai_net` via le DNS interne Docker. Idem `qdrant`.

### Notes
- Les 4 nouvelles vars du `.env` sont prévisibles ; on les ajoute groupées sous un bloc commenté pour clarté.
- `depends_on: [openclaw]` côté `deepagents` est documentaire (Compose redémarre dans l'ordre, mais pas de healthcheck strict). Suffisant pour l'usage CLI.
- Le test sur les labels Traefik vérifie le domaine injecté par eta — pas l'interpolation `${BASE_DOMAIN}` (qui reste une string dans la sortie eta).
