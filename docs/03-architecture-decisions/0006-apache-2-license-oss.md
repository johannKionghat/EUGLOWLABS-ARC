# ADR-0006 : Apache 2.0 pour les composants OSS, closed-source pour ARC Cloud

## Statut
Accepté
Date : 2026-05-01

## Contexte
EuglowLabs ARC est un produit dual : composants self-hosted pour solo founders (gratuit) + service SaaS payant (ARC Cloud). Il faut un schéma de licence qui :
- Permet l'adoption massive en self-host (signal de confiance, audit possible)
- Protège le moat business du SaaS multi-tenant
- Évite les rugs pulls type "rebrand par concurrent" (cf. drama Hashicorp / OpenTofu)
- Est compatible avec les dépendances en place (Coolify Apache 2.0, `local-ai-packaged` MIT)

Inspirations : Plausible Analytics (AGPL self-host + SaaS managé), PostHog (MIT self-host + Cloud closed), Supabase (Apache 2.0 + Cloud closed).

## Décision
Schéma de licence acté :

| Composant | Licence | Repo |
|---|---|---|
| CLI `arc` | **Apache 2.0** | public |
| ARC Agent | **Apache 2.0** | public |
| ARC Dashboard (self-hosted) | **Apache 2.0** | public |
| `arc-shared` (types, zod) | **Apache 2.0** | public |
| **ARC Cloud** (backend SaaS) | **Closed source** | privé |
| Templates marketplace officiels | Apache 2.0 par défaut, custom pour premium | public |

Modèle économique : inspiré **Plausible / PostHog** — gratuit self-host, payant pour le multi-tenant managé + AI Copilot premium + marketplace.

## Conséquences
+ Apache 2.0 = adoption maximale, compatible entreprise (vs AGPL qui freine)
+ Audit possible des composants critiques (Agent, CLI) — rassure sécurité
+ ARC Cloud closed-source protège le code multi-tenant + intégrations Stripe/Clerk
+ Cohérence avec Coolify (Apache 2.0)
- Apache 2.0 permet techniquement à un concurrent de prendre le code et de SaaS-ifier — atténué par le moat ARC Cloud (auth, billing, marketplace, Sentinel premium) qui est closed
- Pas de protection "must-share-modifications" comme AGPL — assumé

## Alternatives rejetées
- **AGPL** — freine l'adoption entreprise (politique légale anti-AGPL répandue)
- **BSL (Business Source License)** — signal négatif communauté, complexité juridique
- **Tout closed-source** — perd le levier d'acquisition self-host gratuit
- **MIT** — plus permissif qu'Apache 2.0, mais Apache 2.0 inclut clause patent express → meilleur pour un produit infra
