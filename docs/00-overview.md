# EuglowLabs ARC — Overview

## Vision (3 phrases)

EuglowLabs ARC (Autonomous Resource Cloud) transforme n'importe quel VPS en plateforme self-hosted complète "Vercel + Supabase + Ollama" via une seule commande. Le produit fournit un cockpit unifié pour superviser, opérer et faire évoluer toute la stack (apps, BDD, IA, sandbox) avec un mode dual local/VPS identique. ARC s'appuie sur Coolify comme orchestrateur (jamais forké) et `local-ai-packaged` pour la stack IA, et ajoute la couche manquante : bootstrap automatisé, dashboard agrégé, multi-tenant et AI Copilot.

## Composants principaux

| Composant | Rôle | Stack |
|---|---|---|
| **CLI `arc`** | Bootstrap, deploy, backup, migrate, project mgmt | Bun + clipanion + zod |
| **ARC Agent** | Service installé sur chaque VPS, expose state au Dashboard | Go + chi + gorilla/websocket |
| **ARC Dashboard** | UI de supervision (self-host ou cloud) — niveaux 1, 2, 3 | Next.js 15 + shadcn/ui |
| **ARC Cloud** | Backend SaaS multi-tenant (auth, billing, marketplace) | Next.js 15 + Drizzle + Clerk + Stripe |
| **Sentinel** | AI Copilot intégré au Dashboard | LangGraph + Claude/GPT/Ollama |
| **Marketplace** | Bibliothèque de templates one-click (apps, agents, workflows) | GHCR + R2 + custom CDN |

## Schéma global (cible Niveau 3)

```
                 ┌──────────────────────────────┐
                 │   ARC Cloud (multi-tenant)   │
                 │   arc.euglowlabs.com         │
                 │   Auth + Stripe + Marketplace│
                 └──────────────┬───────────────┘
                                │ API publique REST/WS
                                ▼
   ┌────────────────────────────────────────────────────────┐
   │              ARC Dashboard (Next.js 15)                 │
   │  Self-hosted ou cloud — niveaux 1, 2, 3                 │
   └────────────────────────────────────────────────────────┘
                                │ read-only API + WebSocket
                                ▼
   ┌────────────────────────────────────────────────────────┐
   │              ARC Agent (sur chaque VPS managé)          │
   │  Go binary léger, port 9999, token signé                │
   └────────────────────────────────────────────────────────┘
                                │
       ┌──────────┬──────────┬──────────┬──────────┐
       │ Coolify  │ Ollama   │ Langfuse │ Postgres │
       └──────────┴──────────┴──────────┴──────────┘
       prod_net (vert) │ ai_net (bleu) │ sandbox_net (rouge, internal:true)
```

## Spécifications détaillées

- Spec infra : [`01-spec-infra.md`](./01-spec-infra.md)
- Spec produit : [`02-spec-arc-product.md`](./02-spec-arc-product.md)
- ADRs : [`03-architecture-decisions/`](./03-architecture-decisions/)
- Conventions : [`04-conventions/`](./04-conventions/)
- Glossaire : [`05-glossary.md`](./05-glossary.md)

## Roadmap (8 phases)

Cf. `02-spec-arc-product.md` §14 et `tasks/INDEX.md`.

- **Phase 0** — Setup monorepo & tooling (semaine 1)
- **Phase 1** — CLI MVP (semaines 2-4)
- **Phase 2** — ARC Agent (semaines 5-6)
- **Phase 3** — Dashboard Niveau 1 — status page (semaines 7-9)
- **Phase 4** — ARC Cloud MVP — multi-tenant + billing (semaines 10-13)
- **Phase 5** — Sentinel AI Copilot
- **Phase 6** — Marketplace
- **Phase 7** — API publique & SDKs
- **Phase 8** — Polish & growth (continu)
