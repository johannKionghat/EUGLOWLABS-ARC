# ADR-0001 : Monorepo Turborepo + pnpm workspaces

## Statut
Accepté
Date : 2026-05-01

## Contexte
EuglowLabs ARC se compose de plusieurs livrables fortement liés mais déployables indépendamment : CLI `arc`, ARC Agent (Go), ARC Dashboard (Next.js), ARC Cloud (Next.js SaaS), et des packages partagés (types, schémas zod, utils). Itérer en cohérence sur un type partagé entre CLI et Dashboard, ou entre Agent et Cloud, est un cas quotidien attendu.

Le projet est mené en solo founder pendant ~10-12 mois. Le coût de friction de la PR cross-repo est inacceptable à cette échelle.

## Décision
Tout le code TypeScript de EuglowLabs ARC vit dans un **monorepo unique `euglowlabs-arc`**, géré avec **Turborepo + pnpm workspaces**.

Layout cible :
```
euglowlabs-arc/
├── packages/
│   ├── arc-cli/         (@euglowlabs/arc-cli, Bun)
│   ├── arc-agent/       (Go, hors workspace pnpm — voir ADR-0003)
│   ├── arc-dashboard/   (@euglowlabs/arc-dashboard, Next.js)
│   ├── arc-cloud/       (@euglowlabs/arc-cloud, Next.js)
│   └── arc-shared/      (@euglowlabs/arc-shared, types & zod)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Conséquences
+ Refacto cross-package atomique (un seul PR, types alignés)
+ Cache de build partagé via Turborepo (`turbo build`, `turbo test`)
+ pnpm hoisting réduit l'espace disque et accélère `install`
+ Versioning unifié possible via Changesets si on publie sur npm
- Le repo grossit, le `clone` devient plus lourd au fil des phases
- ARC Agent (Go) cohabite mais reste hors du graphe Turbo (build via Makefile)

## Alternatives rejetées
- **Nx** — overkill pour un solo founder, courbe d'apprentissage et plugins lourds, alors que Turbo couvre 95% du besoin
- **Polyrepos** (`arc-cli`, `arc-agent`, `arc-dashboard` séparés) — perte de cohérence des types, multiplicité de PRs cross-repo, friction quotidienne
- **Yarn workspaces** — pnpm est plus rapide et plus économe en disque ; aucune feature manquante pour ce projet
