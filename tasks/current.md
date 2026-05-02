# Tâche en cours : CLI-009 — Adapter abstrait `ExecutionAdapter` interface

## Statut
🟡 En cours — démarrée le 2026-05-02

## Objectif
Démarrer le **chapitre orchestration**. Définir l'interface TS `ExecutionAdapter` qui isole la couche d'exécution (commandes shell, copies de fichier, lecture FS distante) — implémentation directe d'**ADR-0009**. Le contrat posé ici est ce qui permettra à toutes les commandes d'orchestration (deploy, status, logs, backup) d'être agnostiques de la cible. CLI-010 fournira `LocalAdapter` (execa), CLI-011 `VPSAdapter` (node-ssh + Hetzner). On ajoute aussi un `MockAdapter` test-only qui sert dès maintenant.

## Critères d'acceptation
- [ ] Interface `ExecutionAdapter` exportée depuis `@euglowlabs/arc-cli/exec`
- [ ] Types `ExecOpts`, `ExecResult`, `ExecChunk` exportés
- [ ] L'interface couvre : `exec`, `copyFile`, `readFile`, `fileExists`, `describe`
- [ ] `ExecOpts` supporte `cwd`, `env`, `onChunk` (streaming par chunk stdout/stderr), `timeoutMs`
- [ ] `ExecResult` contient `stdout`, `stderr`, `exitCode`, `durationMs`
- [ ] `MockAdapter` implémente `ExecutionAdapter`, enregistre les appels et permet de programmer des réponses
- [ ] ≥ 4 tests Vitest sur `MockAdapter` : exec non programmé, exec programmé + onChunk, copyFile + fileExists, readFile inexistant rejette
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` verts
- [ ] CI verte sur la PR
- [ ] PR mergée sur main

## Fichiers concernés (estimation)
- `packages/arc-cli/src/exec/types.ts` (création — interface + types)
- `packages/arc-cli/src/exec/mock.ts` (création — `MockAdapter`)
- `packages/arc-cli/src/exec/mock.test.ts` (création — 4 tests)
- `packages/arc-cli/src/exec/index.ts` (création — barrel)

## ADRs liés
- **ADR-0009** — Dual target local/VPS avec pattern adapter (la tâche est l'application littérale)
- ADR-0001 — Monorepo Turborepo
- ADR-0002 — Bun runtime CLI / clipanion

## Conventions à respecter
- `coding-style.md` — TS strict, JSDoc, kebab-case fichiers, pas d'`any`
- `testing.md` — Vitest collocated, cas limites couverts
- `naming.md` — branche `feat/CLI-009-execution-adapter`, scope `cli`

## Hors scope (NE PAS faire)
- Pas de **`LocalAdapter`** (CLI-010) ni **`VPSAdapter`** (CLI-011)
- Pas de **dépendances** runtime ajoutées (`execa`/`node-ssh` viennent avec CLI-010/011)
- Pas de **commande clipanion** exposée
- Pas d'**`EventEmitter`** — le callback `onChunk` suffit
- Pas de **classes d'erreur custom** (`SignalError`, `TimeoutError`) — `Error` standard avec `cause`

## Plan d'implémentation

### Sous-tâche 1 : Types et interface
- **Fichiers** : `src/exec/types.ts`
- **Effort estimé** : 15 min
- **Détail** :
  - `ExecChunk` : `{ stream: "stdout" | "stderr"; data: string }`
  - `ExecOpts` : `{ cwd?, env?, onChunk?, timeoutMs? }`
  - `ExecResult` : `{ stdout, stderr, exitCode, durationMs }`
  - `ExecutionAdapter` : `exec`, `copyFile`, `readFile`, `fileExists`, `describe`
  - JSDoc renvoyant à ADR-0009. `copyFile` documenté comme "depuis machine opérateur → filesystem adapter".

### Sous-tâche 2 : MockAdapter
- **Fichiers** : `src/exec/mock.ts`
- **Effort estimé** : 15 min
- **Détail** : Classe avec état interne `calls[]`, `execResponses: Map`, `files: Map<string, string>`. Helpers `programExec(cmd, response)` et `seedFile(path, content)`. `exec()` applique `onChunk` si dispo. `copyFile` enregistre + place un marqueur dans `files`. `readFile` throw ENOENT si absent. `describe(): "mock"`.

### Sous-tâche 3 : Tests Vitest + barrel
- **Fichiers** : `src/exec/mock.test.ts`, `src/exec/index.ts`
- **Effort estimé** : 15 min
- **Détail** :
  1. `exec("noop")` non programmé → exit 0, stdout/stderr vides, call enregistré
  2. `programExec("ls", { stdout: "a\nb\n", ... })` + `onChunk` collecte → réponse correcte + chunks reçus
  3. `copyFile(src, dest)` puis `fileExists(dest) === true`
  4. `readFile("/inexistant")` rejette avec message contenant ENOENT, `fileExists` retourne false
  Barrel exporte tous les symboles publics.

### Sous-tâche 4 : Vérif + commit + PR
- **Fichiers** : aucun nouveau
- **Effort estimé** : 10 min
- **Détail** : Inclure les artefacts pendants de CLI-008. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Branche `feat/CLI-009-execution-adapter`. Commit `feat(cli): define ExecutionAdapter interface and MockAdapter [CLI-009]`. Push, PR, attendre CI verte, merger.

## Scratchpad

### Décisions ouvertes — à valider avant de coder
- **Localisation `src/exec/`** plutôt que `src/adapters/` (plus précis, exécution = sa responsabilité). Réversible.
- **`copyFile` sémantique** : opérateur → adapter. Pas de `downloadFile` pour l'instant ; `readFile` suffit.
- **Pas d'`EventEmitter`** ni async-iterator pour les chunks : callback suffit. Si besoin pause/resume/abort, on ajoutera `AbortSignal` dans `ExecOpts` (Node natif).
- **`timeoutMs`** non appliqué côté `MockAdapter` (responsabilité des impls réelles).
- **`describe()` libre forme** : `"local"`, `"vps:1.2.3.4"`, etc. Pas un enum.

### Notes
- L'interface vit dans `arc-cli`, pas `arc-shared` — l'Agent (Go) et le Cloud (TS) n'auront pas la même couche d'exécution.
- `MockAdapter` exporté du package — utile pour tests CLI-012+. Si publication npm un jour, on pourra l'isoler dans un sous-export.
- `ExecChunk.data` est une `string` UTF-8 (pas un `Buffer`) pour simplicité.
