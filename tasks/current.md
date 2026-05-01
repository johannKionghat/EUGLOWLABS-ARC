# Tâche en cours : INFRA-001 — Setup monorepo Turborepo

## Statut
🟡 En cours — démarrée le 2026-05-01

## Objectif
Initialiser la structure Turborepo du monorepo `euglowlabs-arc` avec pnpm workspaces et 5 packages placeholders (`arc-cli`, `arc-shared`, `arc-dashboard`, `arc-cloud`, `arc-agent`). Aucune logique métier — uniquement la plomberie permettant aux tâches suivantes (CLI-001, AGENT-001, DASH-001, CLOUD-001) de démarrer sur des fondations CI-vérifiées.

## Critères d'acceptation
- [ ] `pnpm install` fonctionne sans warning
- [ ] `pnpm build` passe sur les 5 packages (placeholders OK)
- [ ] `pnpm test` lance Vitest sans erreur (0 test trouvé acceptable)
- [ ] `pnpm lint` (Biome) passe à zéro erreur
- [ ] `pnpm typecheck` passe sur tous les packages TS
- [ ] `make -C packages/arc-agent build` produit un binaire Go
- [ ] CI GitHub Actions verte sur la PR

## Fichiers concernés (estimation)

**Racine**
- `package.json` (création)
- `pnpm-workspace.yaml` (création)
- `turbo.json` (création)
- `tsconfig.base.json` (création)
- `biome.json` (création)
- `.npmrc` (création)
- `.editorconfig` (création)
- `.tool-versions` (création)

**Packages TS**
- `packages/arc-cli/{package.json,tsconfig.json,src/index.ts}` (création)
- `packages/arc-shared/{package.json,tsconfig.json,src/index.ts}` (création)
- `packages/arc-dashboard/{package.json,tsconfig.json,src/index.ts}` (création)
- `packages/arc-cloud/{package.json,tsconfig.json,src/index.ts}` (création)

**Package Go**
- `packages/arc-agent/{Makefile,go.mod,cmd/agent/main.go}` (création)

**CI**
- `.github/workflows/ci.yml` (création)

## ADRs liés
- ADR-0001 — Monorepo Turborepo + pnpm workspaces
- ADR-0002 — Bun runtime CLI (placeholder seulement, build complet → CLI-025)
- ADR-0003 — Go pour ARC Agent (skeleton seulement)
- ADR-0004 — Next.js 15 (placeholders, pas de pages réelles)

## Conventions à respecter
- `docs/04-conventions/coding-style.md` — section TypeScript (strict, noUncheckedIndexedAccess)
- `docs/04-conventions/git-workflow.md` — branche `feat/INFRA-001-setup-monorepo`, squash merge
- `docs/04-conventions/naming.md` — packages `@euglowlabs/arc-*`, scope `INFRA`
- `docs/04-conventions/pr-review.md` — auto-revue avant PR

## Hors scope (NE PAS faire)
- Pas de logique métier (pas de schémas zod réels, pas de commandes CLI, pas de pages Next.js, pas de handlers HTTP Go)
- Pas de dépendances applicatives (zod, drizzle, clipanion, clerk, chi, gorilla/websocket, …)
- Pas de Dockerfile applicatif (reporté à DASH-014, AGENT-013)
- Pas de configuration Ansible (reporté à CLI-013)
- Pas d'intégration Coolify (reporté à CLI-021)
- Pas de Changesets ni de release npm (reporté à INFRA-008, INFRA-010)
- Pas de hooks lefthook ni `commit-msg` (reporté à INFRA-007)

## Plan d'implémentation

### Sous-tâche 1 : Fondations racine (workspace + tooling)
- **Fichiers** : `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `.editorconfig`, `.tool-versions`
- **Effort estimé** : 15 min
- **Détail** : `package.json` racine en `private: true` avec scripts `build`, `test`, `lint`, `typecheck` qui délèguent à `turbo run`. `pnpm-workspace.yaml` pointe sur `packages/*`. `.tool-versions` fixe Node ≥20, Bun, Go ≥1.22, pnpm. `.editorconfig` LF + 2 spaces TS / tabs Go.

### Sous-tâche 2 : Pipelines Turbo + TypeScript base + Biome
- **Fichiers** : `turbo.json`, `tsconfig.base.json`, `biome.json`
- **Effort estimé** : 20 min
- **Détail** : `turbo.json` définit pipelines `build`, `test`, `lint`, `typecheck` avec `dependsOn: ["^build"]` et caches. `tsconfig.base.json` strict + `noUncheckedIndexedAccess` + `target: ES2022` + `module: ESNext` + `moduleResolution: Bundler`. `biome.json` formatter + linter racine, ignore `dist/`, `.next/`, `.turbo/`.

### Sous-tâche 3 : Packages TS placeholders (cli, shared)
- **Fichiers** : `packages/arc-cli/{package.json,tsconfig.json,src/index.ts}`, idem pour `arc-shared`
- **Effort estimé** : 15 min
- **Détail** : `package.json` `@euglowlabs/arc-cli` avec scripts `build` (`tsc -p tsconfig.json`), `test` (`vitest run`), `typecheck`. `tsconfig.json` étend la base, `outDir: dist`. `src/index.ts` minimal (`export const version = "0.0.0";`). Idem `arc-shared`.

### Sous-tâche 4 : Packages TS placeholders (dashboard, cloud)
- **Fichiers** : `packages/arc-dashboard/*`, `packages/arc-cloud/*`
- **Effort estimé** : 15 min
- **Détail** : Mêmes patterns que sous-tâche 3 mais sans bootstrap Next.js réel (juste un `src/index.ts` placeholder + `package.json` avec scripts cohérents). Le bootstrap Next.js complet appartient à DASH-001 et CLOUD-001.

### Sous-tâche 5 : Skeleton Go arc-agent
- **Fichiers** : `packages/arc-agent/{Makefile,go.mod,cmd/agent/main.go}`
- **Effort estimé** : 15 min
- **Détail** : `go.mod` `module github.com/euglowlabs/arc-agent`, Go 1.22. `cmd/agent/main.go` minimal qui imprime la version. `Makefile` cibles `build`, `test`, `clean`, avec cross-compile linux/amd64 + linux/arm64. Pas de dépendances tierces.

### Sous-tâche 6 : Vitest workspace + scripts racine
- **Fichiers** : `vitest.workspace.ts` (racine), ajustement `package.json` racine
- **Effort estimé** : 10 min
- **Détail** : `vitest.workspace.ts` agrège les configs Vitest des 4 packages TS. Script `test` racine = `vitest run` (et délégation Go via `pnpm --filter` si applicable). Vérifier `pnpm test` ne lève pas d'erreur même sans aucun test.

### Sous-tâche 7 : CI GitHub Actions
- **Fichiers** : `.github/workflows/ci.yml`
- **Effort estimé** : 20 min
- **Détail** : Job `node` (matrix Node 20) : checkout → pnpm/action-setup → install → `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build`. Job `go` séparé : checkout → setup-go → `make -C packages/arc-agent build` + `make -C packages/arc-agent test`. Trigger sur `pull_request` + `push: main`.

### Sous-tâche 8 : Vérification finale + commit
- **Effort estimé** : 15 min
- **Détail** : Lancer en local `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, et `make -C packages/arc-agent build`. Vérifier qu'il ne reste pas de warnings. Préparer un commit Conventional Commits unique : `chore(repo): bootstrap turborepo monorepo [INFRA-001]`. Push sur branche `feat/INFRA-001-setup-monorepo`.

## Scratchpad

### Sous-tâches réalisées (2026-05-02)
- [x] **1 — Fondations racine** : `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `.editorconfig`, `.tool-versions`
- [x] **2 — Pipelines** : `turbo.json` (build/test/lint/typecheck/clean), `tsconfig.base.json` (strict + noUncheckedIndexedAccess + verbatimModuleSyntax), `biome.json` (formatter + linter racine, ignore arc-agent)
- [x] **3 — Packages TS (cli, shared)** : placeholders `src/index.ts`, `arc-cli` consomme `@euglowlabs/arc-shared` via `workspace:*`
- [x] **4 — Packages TS (dashboard, cloud)** : placeholders alignés
- [x] **5 — Skeleton Go** : `go.mod` (Go 1.23), `cmd/agent/main.go`, `Makefile` (build + cross-compile linux/amd64+arm64)
- [x] **6 — Vitest** : pas de workspace racine, chaque package a `vitest run --passWithNoTests` orchestré par Turbo
- [x] **7 — CI GitHub Actions** : job Node (pnpm install → lint → typecheck → test → build) + job Go (vet → test → build)
- [ ] **8 — Vérification finale + commit** : à exécuter par l'utilisateur (cf. ci-dessous)

### Décisions prises
- **Pas de Vitest workspace** racine : chaque package délègue à Turbo. Évite les surprises de discovery quand un package n'a pas de tests.
- **Biome racine seul** : un seul `biome.json`, pas de config par package. arc-agent (Go) ignoré explicitement.
- **`workspace:*`** pour les deps internes : remplacé au publish par Changesets (INFRA-008).
- **TypeScript project references retirées** : Turbo `dependsOn: ["^build"]` garantit l'ordre. Plus simple à maintenir.
- **Versions épinglées** : Turbo 2.3.3, Vitest 2.1.8, Biome 1.9.4, TypeScript 5.6.3, Node 20.18.1, pnpm 9.12.0, Go 1.23.

### Vérifications restantes (à lancer côté utilisateur avant commit)
```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
make -C packages/arc-agent build
make -C packages/arc-agent test
```

### Commit prévu
```
chore(repo): bootstrap turborepo monorepo [INFRA-001]
```
Branche : `feat/INFRA-001-setup-monorepo`
