# CLAUDE.md — EuglowLabs ARC

**EuglowLabs ARC** (Autonomous Resource Cloud) est un produit de **EuglowLabs**.
Il transforme un VPS en plateforme self-hosted complète (Vercel + Supabase + Ollama-like) via un CLI unique et un cockpit unifié.

## 🎯 Mode actuel

**CHANTIER 1 EN COURS** — toute tâche Chantier 2 gelée jusqu'à validation utilisateur explicite (voir [ADR-0013](docs/03-architecture-decisions/0013-chantier-1-2-separation.md)).

- 🔨 **Chantier 1 actif** : CLI `arc`, stack déployée (Coolify + local-ai-packaged + sandbox + agents), Dashboard self-hosted Niveau 1, ARC Agent en Go, migration des 4 projets, tests E2E + doc.
- 🧊 **Chantier 2 gelé** : ARC Cloud, Auth Clerk, Stripe, Sentinel, Marketplace, API publique + SDKs, Webhooks, Plugin system, pages Dashboard Niveau 2/3.

Le passage Chantier 1 → 2 nécessite **les 5 critères de validation** (cf. `tasks/CHANTIER-1-VALIDATION.md`) **et** un message exact `"go chantier 2"` de l'utilisateur dans la conversation.

**Modèle d'install actif** : single-machine (ADR-0012) — l'utilisateur SSH dans son VPS, lance `arc setup` sur place. Plus de mode dual `local | vps`. ADR-0009 superseded.

## Source de vérité

Deux specs gouvernent le projet — toute décision doit s'y rattacher :
- `docs/01-spec-infra.md` — spec technique infrastructure (CLI, Ansible, Docker, réseaux)
- `docs/02-spec-arc-product.md` — spec produit (vision, composants, roadmap 8 phases)

Tout désaccord avec ces docs nécessite un ADR avant action.

## Avant toute action — checklist obligatoire

1. Lire `CLAUDE.md` (ce fichier)
2. Lire `tasks/current.md` — la tâche active
3. Lire les ADRs cités par la tâche (`docs/03-architecture-decisions/`)
4. Lire les conventions concernées (`docs/04-conventions/`)
5. Si un terme est inconnu → consulter `docs/05-glossary.md`

## Règles non-négociables

- **JAMAIS démarrer une tâche située dans `tasks/backlog/chantier-2-deferred/`** sans message explicite de l'utilisateur `"go chantier 2"`. Même si l'utilisateur semble demander une feature Chantier 2 en passant, tu refuses et tu rappelles ADR-0013. Tant que les 5 critères de `tasks/CHANTIER-1-VALIDATION.md` ne sont pas tous cochés ET que l'utilisateur n'a pas envoyé `"go chantier 2"`, le périmètre Chantier 2 reste interdit.
- **TypeScript strict** (`strict: true`, `noUncheckedIndexedAccess`), **zéro `any`** sans justification commentée
- **Tests obligatoires** pour toute logique métier (Vitest pour TS, `go test` pour Agent)
- **1 PR = 1 tâche < 2h** de travail. Si ça déborde → découper.
- **Coolify n'est jamais forké** — c'est une dépendance avec attribution upstream (cf. ADR-0005)
- **Ne jamais modifier 2 packages dans la même PR** — un changement = une frontière de package
- **Pas de scope creep** — si une feature n'est pas dans les specs, écrire un ADR draft, ne pas coder
- **Pas de secret en dur**, jamais. `.env` → `.gitignore`.
- Si > 5 fichiers modifiés → STOP, demander confirmation à l'utilisateur

## Stack figée (cf. ADRs)

| Composant | Stack | ADR |
|---|---|---|
| Monorepo | Turborepo + pnpm workspaces | ADR-0001 |
| CLI `arc` | Bun + clipanion + zod, single binary via `bun build --compile` | ADR-0002 |
| ARC Agent | Go + chi/echo + gorilla/websocket | ADR-0003 |
| ARC Dashboard | Next.js 15 App Router + shadcn/ui + Zustand + TanStack Query | ADR-0004 |
| ARC Cloud (SaaS) | Next.js 15 + Drizzle + Clerk + Stripe + Supabase managed | ADR-0010 |
| Postgres partagé | Supabase self-hosted via `local-ai-packaged`, 1 DB par projet | ADR-0007 |
| Réseaux Docker | `prod_net`, `ai_net`, `sandbox_net` (`internal: true`) | ADR-0008 |
| Modèle install | Single-machine sur la cible, `arc setup` exécute Ansible en `localhost` | ADR-0012 *(supersede ADR-0009)* |
| Licence OSS | Apache 2.0 (CLI, Agent, Dashboard) ; ARC Cloud closed | ADR-0006 |

## Naming (cf. `docs/04-conventions/naming.md`)

- Produit : **EuglowLabs ARC**
- Repo / dossier : `euglowlabs-arc`
- CLI binary : `arc` (jamais `euglowlabs-arc` en CLI)
- Packages npm : `@euglowlabs/arc-cli`, `@euglowlabs/arc-shared`, `@euglowlabs/arc-dashboard`, `@euglowlabs/arc-cloud`
- Tâches : `[SCOPE]-NNN` (ex: `CLI-042`, `DASH-007`, `AGENT-013`, `CLOUD-021`, `INFRA-001`)
- Branches : `feat/CLI-042-add-deploy-command`
- Commits Conventional : `feat(cli): add deploy command [CLI-042]`

## Workflow par tâche

1. Lire `tasks/current.md` intégralement
2. Proposer un **plan d'implémentation** à l'utilisateur (fichiers touchés, sous-tâches, tests prévus)
3. **Attendre validation explicite** avant de coder
4. Coder **sous-tâche par sous-tâche**, en cochant les critères au fur et à mesure
5. Tests verts en local (lint + unit + types)
6. **1 commit atomique** par sous-tâche logique, message Conventional Commits
7. Mettre à jour le scratchpad de `current.md` au fur et à mesure
8. À la fin : déplacer la tâche vers `tasks/completed/`, mettre à jour `tasks/INDEX.md` (✅), choisir la suivante via `tasks/INDEX.md` ou `tasks/backlog/`

## Limites de scope (STOP signals)

- Si la tâche touche > 5 fichiers → STOP, redécouper
- Si une feature demandée n'est pas dans les specs → STOP, écrire un ADR draft
- Si une décision technique structurante n'est pas couverte par un ADR → STOP, proposer un nouvel ADR
- Si un test devient impossible à écrire → STOP, signaler avant de hacker

## Références transverses

- ADRs : `docs/03-architecture-decisions/` — décisions structurantes, ne pas dévier sans nouvel ADR
- Conventions : `docs/04-conventions/` — coding-style, naming, git-workflow, testing, pr-review
- Glossaire : `docs/05-glossary.md` — vocabulaire du domaine ARC
- Overview : `docs/00-overview.md` — synthèse 1 page
