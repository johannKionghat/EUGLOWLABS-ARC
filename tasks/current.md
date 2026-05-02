# Tâche en cours : CLI-001 — Squelette clipanion + commande `arc version`

## Statut
🟡 En cours — démarrée le 2026-05-02

## Objectif
Remplacer le placeholder `arc-cli/src/index.ts` par un vrai squelette CLI basé sur **clipanion**, exposant une commande `arc version` (et le flag `--version`). Premier code "produit" du monorepo, fondation de toutes les commandes Phase 1 (init, deploy, status, etc.).

## Critères d'acceptation
- [ ] `pnpm --filter @euglowlabs/arc-cli build` produit `dist/index.js` exécutable
- [ ] `node packages/arc-cli/dist/index.js version` affiche `arc 0.0.0`
- [ ] `node packages/arc-cli/dist/index.js --version` affiche `0.0.0`
- [ ] `node packages/arc-cli/dist/index.js --help` affiche l'aide clipanion (binaryName=arc, binaryLabel=EuglowLabs ARC)
- [ ] Test Vitest qui exécute le runner clipanion et asserte la sortie de `version`
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` verts
- [ ] CI verte sur la PR
- [ ] PR mergée sur main

## Fichiers concernés (estimation)
- `packages/arc-cli/package.json` (modif : add `clipanion`, `typanion` deps)
- `packages/arc-cli/src/version.ts` (création — constante `VERSION = "0.0.0"`)
- `packages/arc-cli/src/cli.ts` (création — factory `buildCli()` qui retourne `Cli` configuré)
- `packages/arc-cli/src/commands/version.ts` (création — `VersionCommand` clipanion)
- `packages/arc-cli/src/index.ts` (réécriture — entry point avec shebang `#!/usr/bin/env node` + `cli.runExit`)
- `packages/arc-cli/src/cli.test.ts` (création — Vitest)
- `packages/arc-cli/tsconfig.json` (modif si besoin pour préserver shebang)

## ADRs liés
- ADR-0001 — Monorepo Turborepo
- ADR-0002 — Bun runtime CLI : on **utilise clipanion** (acté). Le single-binary `bun build --compile` est reporté à CLI-025. Pour CLI-001 on cible Node (`#!/usr/bin/env node`) — Bun reste compatible mais on ne dépend pas de Bun installé sur la machine du dev pour `pnpm test`.

## Conventions à respecter
- `docs/04-conventions/coding-style.md` — TS strict, zéro `any`, kebab-case fichiers, JSDoc sur les exports publics
- `docs/04-conventions/testing.md` — Vitest collocated `.test.ts`, cas limites couverts
- `docs/04-conventions/naming.md` — packages `@euglowlabs/arc-*`, scope `cli`

## Hors scope (NE PAS faire)
- Pas d'autres commandes (`init`, `deploy`, `status`, ...) — chacune a sa tâche dédiée (CLI-005, CLI-012, CLI-015, ...)
- Pas de single-binary `bun build --compile` — reporté à CLI-025
- Pas de schéma de config `arc.config.yml` — CLI-003
- Pas de `@clack/prompts` interactif — réservé à CLI-005 (`arc init`)
- Pas de lecture de la version depuis `package.json` runtime — pour l'instant constante en dur (sera factorisé en CLI-025 au build)
- Pas de telemetry — CLI-028
- Pas de publication npm — CLI-026

## Plan d'implémentation

### Sous-tâche 1 : Dépendances + version constante
- **Fichiers** : `packages/arc-cli/package.json`, `packages/arc-cli/src/version.ts`
- **Effort estimé** : 10 min
- **Détail** : Ajouter `clipanion` 4.x et son peer `typanion` à `dependencies`. Créer `src/version.ts` qui exporte `export const VERSION = "0.0.0"` (placeholder, sync avec `package.json` version manuelle pour cette tâche).

### Sous-tâche 2 : Commande VersionCommand
- **Fichiers** : `packages/arc-cli/src/commands/version.ts`
- **Effort estimé** : 10 min
- **Détail** : Définir `class VersionCommand extends Command` (clipanion) avec `static paths = [["version"]]`, méthode `execute()` qui écrit `arc ${VERSION}` sur `this.context.stdout`. Documentation JSDoc sur la classe.

### Sous-tâche 3 : Factory CLI réutilisable pour les tests
- **Fichiers** : `packages/arc-cli/src/cli.ts`
- **Effort estimé** : 15 min
- **Détail** : Exporter `buildCli()` qui crée et retourne un `Cli` configuré (`binaryLabel: "EuglowLabs ARC"`, `binaryName: "arc"`, `binaryVersion: VERSION`), enregistre `VersionCommand` + `Builtins.HelpCommand` + `Builtins.VersionCommand`. Exposer aussi un helper `runFromArgs(args, ctx)` pour faciliter les tests sans toucher `process.argv`.

### Sous-tâche 4 : Entry point binaire
- **Fichiers** : `packages/arc-cli/src/index.ts`
- **Effort estimé** : 5 min
- **Détail** : Réécriture complète. Première ligne `#!/usr/bin/env node` (préservée par tsc). Import `buildCli` puis `buildCli().runExit(process.argv.slice(2))`. Plus de constantes exportées (le test passera par `cli.ts`).

### Sous-tâche 5 : Test Vitest
- **Fichiers** : `packages/arc-cli/src/cli.test.ts`
- **Effort estimé** : 20 min
- **Détail** : Tests collocated. Cas couverts :
  - `runFromArgs(["version"])` → exit 0, stdout contient `arc 0.0.0`
  - `runFromArgs(["--version"])` → exit 0, stdout contient `0.0.0`
  - `runFromArgs([])` → exit non-zero ou aide affichée (selon comportement clipanion par défaut, à vérifier puis figer dans l'assertion)
  - `runFromArgs(["doesnotexist"])` → exit non-zero
  - Capturer stdout via `Writable` mock pour ne pas polluer le runner Vitest.

### Sous-tâche 6 : Vérif + commit + PR
- **Fichiers** : aucun nouveau
- **Effort estimé** : 15 min
- **Détail** : Inclure aussi les artefacts pendants d'INFRA-007 (tasks/INDEX, tasks/current, tasks/completed/2026-05-02-INFRA-007.md). `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Branche `feat/CLI-001-clipanion-skeleton`. Commit `feat(cli): add clipanion skeleton with version command [CLI-001]`. Push, PR, attendre CI verte, merger.

## Scratchpad

### Décisions ouvertes — à valider avant de coder
- **Source de la version** : pour cette tâche on garde une constante `VERSION = "0.0.0"` en dur. La synchronisation automatique avec `package.json#version` sera traitée en CLI-025 (single-binary `bun build --compile` permettra de l'embarquer en `define`). Synchronisation manuelle d'ici là.
- **Shebang `node` vs `bun`** : `node` choisi car Node est la baseline `.tool-versions` (≥20). Bun reste compatible. Le passage à Bun-natif est lié au single-binary, donc CLI-025.
- **`runExit` côté tests** : on n'utilise PAS `runExit` dans les tests (il appelle `process.exit`, casse le runner Vitest). On expose `runFromArgs` qui retourne le code de sortie via `cli.run`.

### Notes
- Clipanion 4.x est stable, ESM-friendly, supporte les built-ins HelpCommand/VersionCommand.
- `typanion` est le peer pour les schémas de validation runtime — peut être déclaré seulement si on commence à utiliser `Option.String({ validator: t.isString() })`. Sinon optionnel. À ajouter quand on aura besoin de valider les options (CLI-005+).
