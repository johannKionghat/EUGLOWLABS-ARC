# EuglowLabs ARC — Overview

## Vision (3 phrases)

EuglowLabs ARC (Autonomous Resource Cloud) transforme n'importe quel VPS — chez n'importe quel provider (OVH, Hetzner, Scaleway, AWS, Raspberry Pi…) — en plateforme self-hosted complète "Vercel + Supabase + Ollama" via une seule commande lancée **sur place** (ADR-0012). Le produit fournit un cockpit unifié pour superviser, opérer et faire évoluer toute la stack (apps, BDD, IA, sandbox) sans dépendance à un orchestrateur externe. ARC s'appuie sur Coolify (jamais forké) et `local-ai-packaged` pour la stack IA, et ajoute la couche manquante : bootstrap single-machine, dashboard self-hosted (Chantier 1) puis multi-tenant + AI Copilot (Chantier 2 — gelé).

## Composants principaux (Chantier 1)

| Composant | Rôle | Stack |
|---|---|---|
| **CLI `arc`** | Install + ops sur la machine cible | Bun + clipanion + zod |
| **ARC Agent** | Service local exposant l'état au Dashboard | Go + chi + gorilla/websocket |
| **ARC Dashboard** | UI de supervision Niveau 1 self-hosted | Next.js 15 + shadcn/ui |

## Composants Chantier 2 (gelés — voir [ADR-0013](03-architecture-decisions/0013-chantier-1-2-separation.md))

| Composant | Rôle |
|---|---|
| **ARC Cloud** | Backend SaaS multi-tenant (auth, billing, marketplace) |
| **Sentinel** | AI Copilot intégré au Dashboard |
| **Marketplace** | Bibliothèque de templates one-click |
| **API publique + SDKs** | REST/WS + clients TS/Python/Go + plugins |
| **Pages Dashboard Niveau 2/3** | `/topology`, `/business`, `/sandbox`, `/compliance`, `/cross-env`, `/billing`, `/team`, etc. |

## Schéma global (cible Chantier 1)

```
   ┌──────────────────────────────────────────────────────────┐
   │  Machine cible (VPS quelconque, RPi, WSL2…)              │
   │  L'utilisateur s'y connecte via SSH et lance arc setup   │
   ├──────────────────────────────────────────────────────────┤
   │  ARC Dashboard (Next.js 15) sur dashboard.<domain>       │
   │  ▲                                                        │
   │  │ HTTP + WebSocket (token local statique)                │
   │  ▼                                                        │
   │  ARC Agent (Go) — bind 127.0.0.1:9999 par défaut          │
   │  ▲                                                        │
   │  │ Docker socket / Coolify API / Ollama API               │
   │  ▼                                                        │
   │  ┌──────────┬──────────┬──────────┬──────────┐            │
   │  │ Coolify  │ Ollama   │ Langfuse │ Postgres │            │
   │  └──────────┴──────────┴──────────┴──────────┘            │
   │  prod_net (vert) │ ai_net (bleu) │ sandbox_net (rouge,    │
   │                                    internal:true)         │
   └──────────────────────────────────────────────────────────┘
```

## Spécifications détaillées

- Spec infra : [`01-spec-infra.md`](./01-spec-infra.md) — *bandeau §6 partiellement superseded par ADR-0012*
- Spec produit : [`02-spec-arc-product.md`](./02-spec-arc-product.md)
- ADRs : [`03-architecture-decisions/`](./03-architecture-decisions/)
- Conventions : [`04-conventions/`](./04-conventions/)
- Glossaire : [`05-glossary.md`](./05-glossary.md)

## Roadmap

Voir `tasks/INDEX.md`. Le projet est strictement séquencé en deux **chantiers** ([ADR-0013](03-architecture-decisions/0013-chantier-1-2-separation.md)) :

### Chantier 1 — actif
- **Phase 0** — Setup monorepo & tooling ✅
- **Phase 1** — CLI MVP ✅
- **Phase 1.5** — Refactor ADR-0012 (single-machine) 🟡
- **Phase 2** — ARC Agent (Go) — auth = token local statique
- **Phase 3** — Dashboard Niveau 1 self-hosted
- **Phase 4** — Validation infra à vide (VALIDATE-001 à 007)

### Chantier 2 — gelé jusqu'à `"go chantier 2"`
ARC Cloud, Sentinel, Marketplace, API+SDKs+Plugins, pages Dashboard Niveau 2/3.
Voir `tasks/backlog/chantier-2-deferred/`.
