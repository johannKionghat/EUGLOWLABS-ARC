# Tâche en cours : INFRA-001 — Setup monorepo Turborepo

## Objectif
Initialiser la structure Turborepo du monorepo `euglowlabs-arc` avec pnpm workspaces et les 5 packages prévus (`arc-cli`, `arc-agent`, `arc-dashboard`, `arc-cloud`, `arc-shared`). Aucune logique métier — uniquement la plomberie.

## Critères d'acceptation
- [ ] `pnpm install` fonctionne sans warning
- [ ] `pnpm build` passe sur les 5 packages (placeholders OK : `index.ts` avec `export {}` ou `console.log("hello")`)
- [ ] `pnpm test` lance Vitest sans erreur (peut être 0 test trouvé)
- [ ] `pnpm lint` passe (Biome racine)
- [ ] CI GitHub Actions verte sur PR de cette tâche
- [ ] Le binaire `arc-agent` (Go placeholder) compile via `make -C packages/arc-agent build`

## Fichiers à créer
- `package.json` (root, `name: "euglowlabs-arc"`, `private: true`)
- `pnpm-workspace.yaml` (`packages/*`)
- `turbo.json` (pipelines `build`, `test`, `lint`, `typecheck`)
- `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`)
- `biome.json` (formatter + linter racine)
- `.npmrc` (`engine-strict=true`, `auto-install-peers=true`)
- `packages/arc-cli/package.json` (`@euglowlabs/arc-cli`, build script Bun)
- `packages/arc-cli/src/index.ts` (placeholder)
- `packages/arc-cli/tsconfig.json`
- `packages/arc-shared/package.json` (`@euglowlabs/arc-shared`)
- `packages/arc-shared/src/index.ts` (placeholder)
- `packages/arc-shared/tsconfig.json`
- `packages/arc-dashboard/package.json` (`@euglowlabs/arc-dashboard`, Next.js 15 placeholder)
- `packages/arc-dashboard/tsconfig.json`
- `packages/arc-cloud/package.json` (`@euglowlabs/arc-cloud`, Next.js 15 placeholder)
- `packages/arc-cloud/tsconfig.json`
- `packages/arc-agent/Makefile` (build / test / clean)
- `packages/arc-agent/cmd/agent/main.go` (placeholder `package main; func main(){}`)
- `packages/arc-agent/go.mod`
- `.github/workflows/ci.yml` (pnpm install → lint → typecheck → test ; job séparé Go)

## ADRs liés
- ADR-0001 — Monorepo Turborepo
- ADR-0002 — Bun runtime CLI (ne pas configurer build CLI complet ici, juste placeholder)
- ADR-0003 — Go pour ARC Agent (juste skeleton, pas de logique)
- ADR-0004 — Next.js 15 (placeholders, pas de pages réelles)

## NE PAS faire dans cette tâche
- Pas de logique métier (pas de schémas zod, pas de commandes CLI réelles, pas de pages Next.js réelles)
- Pas de dépendances applicatives (zod, drizzle, clipanion, clerk, ...) — uniquement le tooling de base
- Pas de Dockerfile applicatif
- Pas de configuration Ansible
- Pas d'intégration Coolify

## Scratchpad
*(Claude met à jour pendant le travail — sous-tâches cochées au fur et à mesure)*

- [ ] Sous-tâche 1 : structure de fichiers vide (mkdir -p)
- [ ] Sous-tâche 2 : `package.json` racine + `pnpm-workspace.yaml`
- [ ] Sous-tâche 3 : `turbo.json` + scripts pnpm
- [ ] Sous-tâche 4 : `tsconfig.base.json` + `biome.json`
- [ ] Sous-tâche 5 : packages TS (cli, shared, dashboard, cloud) — placeholders
- [ ] Sous-tâche 6 : skeleton Go (`arc-agent`) + Makefile
- [ ] Sous-tâche 7 : CI GitHub Actions
- [ ] Sous-tâche 8 : vérif `pnpm install && pnpm build && pnpm test && pnpm lint` verts
- [ ] Sous-tâche 9 : commit + PR

## Notes
- Le runtime Bun est listé dans le `.tool-versions` mais l'installation locale du dev est hors scope de cette tâche.
- Les détails du build single-binary CLI seront traités dans **CLI-025**.
- L'image Docker standalone du Dashboard sera traitée dans **DASH-014**.
