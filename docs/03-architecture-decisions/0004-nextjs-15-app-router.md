# ADR-0004 : Next.js 15 (App Router) pour ARC Dashboard et ARC Cloud

## Statut
Accepté
Date : 2026-05-01

## Contexte
Deux UIs web sont à construire :
- **ARC Dashboard** — UI de supervision, déployable en self-host (gratuit, Apache 2.0) ou en cloud
- **ARC Cloud** — backend SaaS multi-tenant (auth, billing, marketplace, Sentinel)

Besoins communs : SSR pour SEO landing/marketing, RSC pour pages riches en data fetching, streaming, tooling React mature, écosystème UI (shadcn/ui), déploiement Vercel ET self-host (Docker standalone).

Cohérence avec l'écosystème EuglowLabs : tous les autres produits Johann (EuglowLabs, InfinixUI, etc.) sont en Next.js. Pas de raison technique de diverger.

## Décision
**Next.js 15 avec App Router** pour les deux applications, packagées séparément :
- `packages/arc-dashboard` — `@euglowlabs/arc-dashboard`
- `packages/arc-cloud` — `@euglowlabs/arc-cloud`

Stack UI commune :
- Tailwind CSS + shadcn/ui (Radix sous le capot)
- Zustand (state UI) + TanStack Query (data fetching)
- React Hook Form + zod (forms)
- Recharts (graphiques) ; React Flow (topologie réseau, page `/topology`)
- xterm.js (terminal embarqué pour logs)
- Vercel AI SDK (streaming LLM côté Sentinel)

## Conséquences
+ App Router stable en Next.js 15, RSC mature
+ `next build --output=standalone` produit une image Docker self-host viable pour le Dashboard
+ Écosystème shadcn/ui = templates rapides, qualité visuelle élevée
+ Réutilisation de composants entre Dashboard et Cloud via `@euglowlabs/arc-shared` (UI primitives)
- App Router a une courbe d'apprentissage (Server Actions, RSC boundaries) — assumée
- Couplage à l'écosystème React/Vercel — acceptable dans la stratégie produit

## Alternatives rejetées
- **Remix / React Router 7** — excellent framework, mais écosystème plugin moins fourni, et désaligné avec le reste des produits Johann
- **SvelteKit** — moins de composants UI prêts à l'emploi pour un dashboard riche, écart avec stack existante
- **Astro** — orienté contenu, pas adapté à une app interactive complexe (Dashboard avec WS, terminal, graphes)
