# INDEX des tâches — EuglowLabs ARC

Source de vérité pour l'avancement du projet **Chantier 1**.
Chaque tâche est estimée à **< 2h** de travail. Si une tâche déborde, la redécouper.

> 🎯 **CHANTIER 1 EN COURS** — voir [ADR-0013](../docs/03-architecture-decisions/0013-chantier-1-2-separation.md).
> Tâches Chantier 2 (Cloud, Sentinel, Marketplace, API/SDKs/Plugins, pages Dashboard Niveau 2/3) → `tasks/backlog/chantier-2-deferred/`. **Ne pas les démarrer** sans `"go chantier 2"`.

## Légende
- ⬜ Non commencée
- 🟡 En cours
- ✅ Terminée
- 🔴 Bloquée

---

## Phase 0 — Setup monorepo & tooling ✅

- ✅ INFRA-001 — Setup monorepo Turborepo + pnpm workspaces (5 packages placeholders) (2026-05-02)
- ✅ INFRA-002 — Config Biome (lint + format) racine + scripts pnpm *(absorbée par INFRA-001)*
- ✅ INFRA-003 — Config tsconfig.base.json strict + tsconfig par package *(absorbée par INFRA-001)*
- ✅ INFRA-004 — Config Vitest par package (orchestré par Turbo, pas de workspace) *(absorbée par INFRA-001)*
- ✅ INFRA-005 — `.gitignore`, `.editorconfig`, `.tool-versions` *(absorbée par INFRA-001)*
- ✅ INFRA-006 — GitHub Actions CI : Node + Go *(absorbée par INFRA-001)*
- ✅ INFRA-007 — Hook `commit-msg` (Conventional Commits + TASK-ID) via lefthook (2026-05-02)
- ✅ INFRA-008 — Setup Changesets pour versionning packages npm (2026-05-02)
- ✅ INFRA-009 — README racine (présentation produit + quickstart contributeur) (2026-05-02)
- ✅ INFRA-010 — Workflow GitHub Actions de release (publish npm dry-run) (2026-05-02)

---

## Phase 1 — CLI MVP ✅ *(modèle dual ADR-0009 — refactor en Phase 1.5)*

- ✅ CLI-001 — Squelette clipanion + commande `arc version` (2026-05-02)
- ✅ CLI-002 — Commande `arc help` + branding ASCII (2026-05-02)
- ✅ CLI-003 — Schéma zod de `arc.config.yml` (dans `arc-shared`) (2026-05-02)
- ✅ CLI-004 — Loader `arc.config.yml` avec validation zod et messages d'erreur clairs (2026-05-02)
- ✅ CLI-005 — Commande `arc init` interactive (@clack/prompts) — questions de base (2026-05-02)
- ✅ CLI-006 — Génération templates eta : `docker-compose.prod.yml`, `.env` (2026-05-02)
- ✅ CLI-007 — Génération template `docker-compose.sandbox.yml` avec isolation (2026-05-02)
- ✅ CLI-008 — Génération template `docker-compose.agents.yml` (OpenClaw + DeepAgents) (2026-05-02)
- ✅ CLI-009 — Adapter abstrait `ExecutionAdapter` interface *(refactor Phase 1.5 — `LocalAdapter` → `HostAdapter` unique)*
- ✅ CLI-010 — `LocalAdapter` via execa (2026-05-02) *(renommage en Phase 1.5)*
- ✅ CLI-011 — `VPSAdapter` via node-ssh + Hetzner SDK (2026-05-02) ⛔ **À supprimer en Phase 1.5 — ADR-0012**
- ✅ CLI-012 — Commande `arc deploy` orchestrant adapter + Ansible playbooks (2026-05-02)
- ✅ CLI-013 — Intégration Ansible : invocation playbook + stream output (2026-05-02)
- ✅ CLI-014 — State management `.infra/state.json` (lecture/écriture/diff) (2026-05-02)
- ✅ CLI-015 — Commande `arc status` (health check via state + ping services) (2026-05-02)
- ✅ CLI-016 — Commande `arc logs <service>` (tail Docker logs via SSH ou local) (2026-05-02)
- ✅ CLI-017 — Commande `arc restart <service>` (2026-05-02)
- ✅ CLI-018 — Commande `arc backup` (pg_dumpall + snapshots volumes) (2026-05-02)
- ✅ CLI-019 — Upload backups vers Cloudflare R2 via rclone wrapper (2026-05-02)
- ✅ CLI-020 — Commande `arc restore <backup-id>` avec liste interactive (2026-05-02)
- ✅ CLI-021 — Commande `arc project add <name>` (Coolify API + create DB) (2026-05-02)
- ✅ CLI-022 — Commande `arc project list` + `arc project deploy <name>` (2026-05-02)
- ✅ CLI-023 — Commande `arc migrate --from=local --to=<vps-ip>` (2026-05-02) ⛔ **À supprimer en Phase 1.5 — ADR-0012**
- ✅ CLI-024 — Cloudflare Tunnel auto en mode `target: local` (2026-05-02) ⛔ **À supprimer en Phase 1.5 — ADR-0012**
- ✅ CLI-025 — Compilation single binary `bun build --compile` cross-target (2026-05-02)
- ✅ CLI-026 — Publication npm `@euglowlabs/arc-cli` + Homebrew tap (2026-05-02)
- ✅ CLI-027 — Script `install.sh` curl-friendly + endpoint `arc.euglowlabs.com/install.sh` (2026-05-02)
- ✅ CLI-028 — Telemetry opt-in (commande `arc config telemetry on/off`) (2026-05-02)

---

## Phase 1.5 — Refactor ADR-0012 (single-machine)

> Supersede ADR-0009. Voir [ADR-0012](../docs/03-architecture-decisions/0012-single-machine-install.md) et [`docs/refactor-0012-inventory.md`](../docs/refactor-0012-inventory.md).

- ✅ REFACTOR-001 — Suppression chirurgicale code 🟥 (vps.ts, provision.ts, migrate, cloudflared, valid-vps.yml, schemas/provider.ts, dep `node-ssh`) (2026-05-04)
- ✅ REFACTOR-002 — Refactor 🟧 + renommage `LocalAdapter` → `HostAdapter`, schéma config sans `target`/`provider`/`tunnel`, ajout `agent: { bind, port }` (2026-05-04)
- ✅ REFACTOR-003 — Audit "zéro résidu" (4 greps vides côté `packages/src`) + rapport completion + run frais install/test/typecheck/build/lint (2026-05-04)
- ✅ **DOC-001** — `docs/migration-guide.md` + `docs/install-without-public-ip.md` (2026-05-04). Couvre :
  - **§1 — Migrer une app existante vers ARC** : commandes copiables, du dump source jusqu'à `arc project add` + `git push`, en moins de 30 min. Couvre **3 cas** (chacun avec sa procédure pas-à-pas testée à blanc) :
    - **§1.a — Next.js + Postgres simple** (cas le plus commun)
    - **§1.b — App utilisant Supabase** (auth, storage, realtime, edge functions) — équivalence vers le Supabase self-hosted intégré au bundle `local-ai-packaged`
    - **§1.c — App full Vercel** (Postgres + KV + Blob) — équivalences ARC : Postgres self-hosted, Redis maison ou Upstash, MinIO ou R2 pour le blob storage
    Couvre critère C1 d'ADR-0011.
  - **§2 — Déplacer un projet d'une instance ARC à une autre** (`arc backup` sur A → `scp` → `arc restore` sur B). Commandes copiables.
  - **§3 — Dupliquer une instance ARC en staging** (snapshot complet + restore sur VPS dédié, env vars différents).
  - **§4 — Installer ARC sans IP publique** (cas RPi à la maison, WSL2) : install manuelle de `cloudflared`, configuration tunnel pointant sur les services ARC, ce que ça remplace fonctionnellement.
  - **§5 — Rollback** : revenir à un état antérieur avec `arc restore <backup-id>` quand un déploiement casse.
  - **§6 — Troubleshooting** : 5 cas fréquents (DNS pas propagé, certif Let's Encrypt en échec, Coolify inaccessible, Postgres OOM, sandbox bloque legitimement le code agent).
  *(Mitigation obligatoire des P2 + P3 d'ADR-0012. Vérifié à blanc avant validation Chantier 1.)*
- ⬜ INSTALL-001 — Commande `arc setup` all-in-one (questions interactives → écrit `~/.arc/arc.config.yml` → exécute Ansible local → bootstrap stack)
- ⬜ ANSIBLE-001 — Rôles Ansible (hardening UFW + fail2ban, docker, coolify, ai-stack, sandbox, backups) exécutés en `localhost`
- ⬜ DNS-001 — Cloudflare DNS records via API (A wildcard pointant sur l'IP publique de la machine)
- ⬜ E2E-001 — Test bout-en-bout sur VM jetable (CI nightly, ~0,02 €/run). **Critère d'acceptation supplémentaire (issu DOC-001)** : E2E-001 doit valider empiriquement les commandes critiques de `docs/migration-guide.md` (au minimum §1.a et §1.b) et `docs/install-without-public-ip.md` (au minimum §4 et §5). Toute commande qui échoue doit déclencher un patch DOC-001.

---

## Phase 2 — ARC Agent (Go) — Chantier 1

> Auth en Chantier 1 = **token local statique** généré par `arc setup` (cf. ADR-0013). Pas de token rotatif Cloud-signed (Chantier 2).

- ⬜ AGENT-001 — Skeleton Go + Makefile + cross-compilation linux/amd64+arm64
- ⬜ AGENT-002 — HTTP server chi + middleware logging/recover
- ⬜ AGENT-003 — Auth middleware : token local statique (généré par `arc setup`, lu depuis `~/.arc/agent-token`)
- ⬜ AGENT-004 — Endpoint `GET /v1/status` (état global VPS)
- ⬜ AGENT-005 — Endpoint `GET /v1/projects` (proxy Coolify API)
- ⬜ AGENT-006 — Endpoint `GET /v1/services` (Docker SDK list containers)
- ⬜ AGENT-007 — Endpoint `GET /v1/llm/metrics` (proxy Langfuse + Ollama)
- ⬜ AGENT-008 — Endpoint `POST /v1/deploy` (déclenche Coolify deploy)
- ⬜ AGENT-009 — WebSocket `/v1/stream` (gorilla/websocket) — metrics live
- ⬜ AGENT-010 — Collecteur Prometheus (CPU, RAM, disk, containers)
- ⬜ AGENT-011 — TLS auto-signé + pinning côté Dashboard
- ⬜ AGENT-012 — Test E2E : `arc setup` + Agent répond aux endpoints
- ⬜ AGENT-013 — Release binaire GitHub Releases (CI matrix)
- ⬜ AGENT-014 — Intégration Agent dans `arc setup` (installation auto)

---

## Phase 3 — Dashboard Niveau 1 self-hosted — Chantier 1

> Pages Niveau 2/3 (`/topology`, `/business`, `/sandbox`, `/compliance`, `/cross-env`, `/marketplace`, `/copilot`, `/team`, `/billing`) sont Chantier 2 — voir `tasks/backlog/chantier-2-deferred/`.

- ⬜ DASH-001 — Bootstrap Next.js 15 App Router + Tailwind + shadcn/ui
- ⬜ DASH-002 — Layout principal + sidebar + theme dark/light
- ⬜ DASH-003 — Auth simple single-user (mot de passe via env, JWT)
- ⬜ DASH-004 — Client API typé pour ARC Agent (TanStack Query + zod)
- ⬜ DASH-005 — Hook WebSocket `useAgentStream` (reconnect auto)
- ⬜ DASH-006 — Page `/overview` : widgets métriques globales + activité
- ⬜ DASH-007 — Page `/projects` : tableau filtrable + status pills
- ⬜ DASH-008 — Page `/projects/[id]` : détail + ressources + déploiements
- ⬜ DASH-009 — Logs streamés via xterm.js sur `/projects/[id]/logs`
- ⬜ DASH-010 — Page `/ai-stack` : modèles Ollama + tokens Langfuse
- ⬜ DASH-011 — Page `/settings` (config locale + token Agent)
- ⬜ DASH-012 — Empty states + skeleton loaders + error boundaries
- ⬜ DASH-013 — Tests Playwright E2E des parcours critiques (overview → project → logs)
- ⬜ DASH-014 — Image Docker `next build --output=standalone` self-host
- ⬜ DASH-015 — Release v0.2 : tag GitHub + release notes + post r/selfhosted

---

## Phase 4 — Validation infra à vide (avant toute migration)

> **Phase finale du Chantier 1.** Logique : si Coolify / Postgres / Ollama / sandbox plante, on corrige avant que le produit ne soit "livré". Couvre les critères infra (catégorie B) d'[ADR-0011](../docs/03-architecture-decisions/0011-end-to-end-install-acceptance.md).
>
> Les **migrations des 4 projets de l'auteur** (EuglowLabs, InfinixUI, InfinixLoop, EduMatch) **ne sont pas dans cet INDEX** : ce sont des actes d'utilisation post-livraison, pas du dev. Cf. ADR-0011 §"Important — Migration des projets ≠ critère de livraison".

- ⬜ VALIDATE-001 — Vérification que tous les modules de la stack répondent sur leur port (Coolify, Supabase Studio, Ollama, n8n, Open WebUI, OpenClaw, DeepAgents, Uptime Kuma)
- ⬜ VALIDATE-002 — Test SSL Let's Encrypt sur tous les sous-domaines (`coolify`, `supabase`, `chat`, `n8n`, `flowise`, `langfuse`, `status`, `openclaw`, `agents`, `dashboard`)
- ⬜ VALIDATE-003 — Test isolation sandbox (curl google.com depuis sandbox = échec ; ping autres réseaux = échec ; FS read-only effectif)
- ⬜ VALIDATE-004 — Test backup automatique (cron tourne, pg_dumpall valide, upload R2 OK)
- ⬜ VALIDATE-005 — Test restore depuis backup sur DB de test vide (checksum identique)
- ⬜ VALIDATE-006 — Test hardening VPS (UFW actif, fail2ban actif, SSH par clé uniquement)
- ⬜ VALIDATE-007 — Dashboard self-hosted Niveau 1 affiche correctement tous les services (Overview, Projects, AI-Stack, Settings)

---

## 🧊 Chantier 2 — DEFERRED

Tout le périmètre Cloud / Sentinel / Marketplace / API+SDKs+Plugins / Dashboard Niveau 2-3 est gelé jusqu'à validation explicite. Voir :

- `tasks/backlog/chantier-2-deferred/README.md`
- `tasks/backlog/chantier-2-deferred/cloud/TASKS.md` *(backend SaaS pur)*
- `tasks/backlog/chantier-2-deferred/sentinel/TASKS.md`
- `tasks/backlog/chantier-2-deferred/marketplace/TASKS.md`
- `tasks/backlog/chantier-2-deferred/api/TASKS.md`
- `tasks/backlog/chantier-2-deferred/dashboard-l2-l3/TASKS.md` *(pages Dashboard Niveau 2/3)*

**Ne pas démarrer ces tâches sans `"go chantier 2"` de l'utilisateur.**
