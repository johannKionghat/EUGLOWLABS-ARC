# INDEX des tâches — EuglowLabs ARC

Source de vérité pour l'avancement du projet.
Chaque tâche est estimée à **< 2h** de travail. Si une tâche déborde, la redécouper.

## Légende
- ⬜ Non commencée
- 🟡 En cours
- ✅ Terminée
- 🔴 Bloquée

---

## Phase 0 — Setup monorepo & tooling (semaine 1)

- ✅ INFRA-001 — Setup monorepo Turborepo + pnpm workspaces (5 packages placeholders) (2026-05-02)
- ✅ INFRA-002 — Config Biome (lint + format) racine + scripts pnpm *(absorbée par INFRA-001)*
- ✅ INFRA-003 — Config tsconfig.base.json strict + tsconfig par package *(absorbée par INFRA-001)*
- ✅ INFRA-004 — Config Vitest par package (orchestré par Turbo, pas de workspace) *(absorbée par INFRA-001)*
- ✅ INFRA-005 — `.gitignore`, `.editorconfig`, `.tool-versions` *(absorbée par INFRA-001)*
- ✅ INFRA-006 — GitHub Actions CI : Node + Go *(absorbée par INFRA-001)*
- ✅ INFRA-007 — Hook `commit-msg` (Conventional Commits + TASK-ID) via lefthook (2026-05-02)
- ⬜ INFRA-008 — Setup Changesets pour versionning packages npm
- ⬜ INFRA-009 — README racine (présentation produit + quickstart contributeur)
- ⬜ INFRA-010 — Workflow GitHub Actions de release (publish npm dry-run)

---

## Phase 1 — CLI MVP (semaines 2-4)

- ✅ CLI-001 — Squelette clipanion + commande `arc version` (2026-05-02)
- ✅ CLI-002 — Commande `arc help` + branding ASCII (2026-05-02)
- ✅ CLI-003 — Schéma zod de `arc.config.yml` (dans `arc-shared`) (2026-05-02)
- ✅ CLI-004 — Loader `arc.config.yml` avec validation zod et messages d'erreur clairs (2026-05-02)
- ✅ CLI-005 — Commande `arc init` interactive (@clack/prompts) — questions de base (2026-05-02)
- ✅ CLI-006 — Génération templates eta : `docker-compose.prod.yml`, `.env` (2026-05-02)
- ✅ CLI-007 — Génération template `docker-compose.sandbox.yml` avec isolation (2026-05-02)
- ✅ CLI-008 — Génération template `docker-compose.agents.yml` (OpenClaw + DeepAgents) (2026-05-02)
- ✅ CLI-009 — Adapter abstrait `ExecutionAdapter` interface (cf. ADR-0009) (2026-05-02)
- ✅ CLI-010 — `LocalAdapter` via execa (exec, copyFile, stream stdout) (2026-05-02)
- ✅ CLI-011 — `VPSAdapter` via node-ssh + Hetzner SDK (provisioning, exec distant) (2026-05-02)
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
- ✅ CLI-023 — Commande `arc migrate --from=local --to=<vps-ip>` (2026-05-02)
- ✅ CLI-024 — Cloudflare Tunnel auto en mode `target: local` (2026-05-02)
- ✅ CLI-025 — Compilation single binary `bun build --compile` cross-target (Linux/macOS/Win) (2026-05-02)
- ✅ CLI-026 — Publication npm `@euglowlabs/arc-cli` + Homebrew tap (2026-05-02)
- ✅ CLI-027 — Script `install.sh` curl-friendly + endpoint `arc.euglowlabs.com/install.sh` (2026-05-02)
- 🟡 CLI-028 — Telemetry opt-in (commande `arc config telemetry on/off`)

---

## Phase 2 — ARC Agent (semaines 5-6)

- ⬜ AGENT-001 — Skeleton Go + Makefile + cross-compilation linux/amd64+arm64
- ⬜ AGENT-002 — HTTP server chi + middleware logging/recover
- ⬜ AGENT-003 — Auth middleware : token signé par ARC Cloud (HMAC), rotation 24h
- ⬜ AGENT-004 — Endpoint `GET /v1/status` (état global VPS)
- ⬜ AGENT-005 — Endpoint `GET /v1/projects` (proxy Coolify API)
- ⬜ AGENT-006 — Endpoint `GET /v1/services` (Docker SDK list containers)
- ⬜ AGENT-007 — Endpoint `GET /v1/llm/metrics` (proxy Langfuse + Ollama)
- ⬜ AGENT-008 — Endpoint `POST /v1/deploy` (déclenche Coolify deploy)
- ⬜ AGENT-009 — WebSocket `/v1/stream` (gorilla/websocket) — metrics live
- ⬜ AGENT-010 — Collecteur Prometheus (CPU, RAM, disk, containers)
- ⬜ AGENT-011 — TLS auto-signé + pinning côté Dashboard
- ⬜ AGENT-012 — Test E2E : `arc deploy` + Agent répond aux endpoints
- ⬜ AGENT-013 — Release binaire GitHub Releases (CI matrix)
- ⬜ AGENT-014 — Intégration Agent dans `arc deploy` (installation auto)

---

## Phase 3 — ARC Dashboard Niveau 1 (semaines 7-9)

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

## Phase 4 — ARC Cloud MVP (semaines 10-13)

- ⬜ CLOUD-001 — Bootstrap Next.js 15 + Drizzle + Postgres (Supabase managed)
- ⬜ CLOUD-002 — Schéma Drizzle : User, Org, Membership, VPS, Project, ApiKey
- ⬜ CLOUD-003 — Migrations Drizzle + seed dev
- ⬜ CLOUD-004 — Intégration Clerk (signup, login, OAuth GitHub/Google)
- ⬜ CLOUD-005 — Création d'org au signup + invitations membres
- ⬜ CLOUD-006 — Permissions RBAC (owner/admin/member/viewer) middleware
- ⬜ CLOUD-007 — Endpoint `POST /v1/vps/register` consommé par `arc cloud connect`
- ⬜ CLOUD-008 — Génération + rotation token VPS pour ARC Agent
- ⬜ CLOUD-009 — Intégration Stripe : produits Hobby/Pro/Team/Business
- ⬜ CLOUD-010 — Webhooks Stripe : subscription created/updated/canceled
- ⬜ CLOUD-011 — Page `/billing` (Stripe Customer Portal embed)
- ⬜ CLOUD-012 — Page `/team` : liste membres + invitations
- ⬜ CLOUD-013 — Connexion Dashboard self-host ↔ ARC Cloud (via API key)
- ⬜ CLOUD-014 — Lancement waitlist beta + emails Resend transactionnels

---

## Phase 5 — AI Copilot Sentinel

- ⬜ SENTINEL-001 — Architecture LangGraph (planner + tools)
- ⬜ SENTINEL-002 — Tools : `get_project_status`, `get_logs`, `get_metrics`
- ⬜ SENTINEL-003 — Tools : `restart_service`, `deploy`, `backup` avec confirmation 2FA
- ⬜ SENTINEL-004 — UI chat dans Dashboard `/copilot` (Vercel AI SDK streaming)
- ⬜ SENTINEL-005 — Routing modèles : Ollama (Hobby), Claude/GPT (Pro+)
- ⬜ SENTINEL-006 — Memory pgvector : historique conversations par user
- ⬜ SENTINEL-007 — Audit log de toutes les actions Sentinel + reversibilité

---

## Phase 6 — Marketplace

- ⬜ MARKET-001 — Schéma `arc-template.yml` (zod) dans `arc-shared`
- ⬜ MARKET-002 — Validation templates : scanner sécurité (Trivy + custom rules)
- ⬜ MARKET-003 — Registry templates : GitHub Container Registry + index R2
- ⬜ MARKET-004 — Page `/marketplace` Dashboard : liste + recherche + filtres
- ⬜ MARKET-005 — Page détail template + bouton "Deploy on my VPS"
- ⬜ MARKET-006 — Submit workflow templates communautaires (PR template)
- ⬜ MARKET-007 — Stripe Connect : revenue share 70/30 templates premium
- ⬜ MARKET-008 — 20 templates officiels EuglowLabs au lancement

---

## Phase 7 — API publique & SDKs

- ⬜ API-001 — Spec OpenAPI complète (orgs, projects, vps, metrics)
- ⬜ API-002 — Génération doc API (Stoplight ou Scalar)
- ⬜ API-003 — Rate limiting + API key auth
- ⬜ API-004 — SDK TypeScript `@euglowlabs/arc-sdk` (codegen depuis OpenAPI)
- ⬜ API-005 — SDK Python `pip install euglowlabs-arc`
- ⬜ API-006 — SDK Go `github.com/euglowlabs/arc-go`
- ⬜ API-007 — Webhooks sortants (project.deployed, service.crashed, ...)
- ⬜ API-008 — Tutoriels d'intégration (3 use cases concrets)

---

## Phase 8 — Polish & growth

- ⬜ DOC-001 — Site doc Astro Starlight (`docs.arc.euglowlabs.com`)
- ⬜ DOC-002 — Quickstart 15 min (de zéro à premier deploy)
- ⬜ DOC-003 — Reference docs CLI (toutes les commandes)
- ⬜ DOC-004 — Reference docs Dashboard (toutes les pages)
- ⬜ DOC-005 — Guide migration Vercel → ARC
- ⬜ OPS-001 — Audit sécurité externe ARC Agent (avant lancement payant)
- ⬜ OPS-002 — Bug bounty program setup (HackerOne ou similaire)
- ⬜ OPS-003 — Dogfood : héberger EuglowLabs.com sur ARC self-hosted
- ⬜ OPS-004 — Migration ARC Cloud Vercel → ARC self-hosted (case study)
