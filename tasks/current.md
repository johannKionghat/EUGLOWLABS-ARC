# Tâche en cours : CLI-004 — Loader `arc.config.yml` avec validation zod et erreurs claires

## Statut
🟡 En cours — démarrée le 2026-05-02

## Objectif
Lire le fichier `arc.config.yml` depuis le disque, le parser en JS, le valider via `arcConfigSchema` (CLI-003), et retourner soit un `ArcConfig` typé, soit un `ConfigError` avec un message utilisateur lisible (path + raison + extrait). Module consommé par toutes les commandes Phase 1 à venir (deploy, status, project add, …).

## Critères d'acceptation
- [ ] `loadArcConfig(filePath: string)` retourne un `ArcConfig` typé sur fichier valide
- [ ] Erreur explicite si le fichier n'existe pas (path + message clair)
- [ ] Erreur explicite si le YAML est syntaxiquement invalide (path + ligne si possible)
- [ ] Erreur explicite si la validation zod échoue (chaque issue formatée `path.to.field: message`)
- [ ] `ConfigError` exposée comme classe avec `.issues` (pour usage programmatique) et `.toUserMessage()` (pour affichage CLI)
- [ ] ≥ 5 cas Vitest couverts avec fixtures YAML : fichier absent, YAML invalide, valide minimal, valide complet, échec zod multi-issues
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` verts (15 → ≥ 20 tests Vitest globaux)
- [ ] CI verte sur la PR
- [ ] PR mergée sur main

## Fichiers concernés (estimation)
- `packages/arc-cli/package.json` (modif — add `yaml`)
- `packages/arc-cli/src/config/errors.ts` (création — `ConfigError` + `formatZodError`)
- `packages/arc-cli/src/config/load.ts` (création — `loadArcConfig`)
- `packages/arc-cli/src/config/index.ts` (création — barrel)
- `packages/arc-cli/src/config/__fixtures__/valid-local.yml` (création)
- `packages/arc-cli/src/config/__fixtures__/valid-vps.yml` (création)
- `packages/arc-cli/src/config/__fixtures__/invalid-yaml.yml` (création — YAML mal formé exprès)
- `packages/arc-cli/src/config/__fixtures__/invalid-schema.yml` (création — YAML valide mais zod fail)
- `packages/arc-cli/src/config/load.test.ts` (création — Vitest)

## ADRs liés
- ADR-0001 — Monorepo Turborepo
- ADR-0002 — Bun runtime CLI / clipanion (loader sera consommé par toutes les commandes)
- ADR-0009 — Dual target local/VPS (le schéma chargé contient `target`)

## Conventions à respecter
- `docs/04-conventions/coding-style.md` — TS strict, JSDoc sur exports, kebab-case fichiers, pas d'`any`
- `docs/04-conventions/testing.md` — Vitest collocated, cas limites couverts (null, vide, fichier absent)
- `docs/04-conventions/naming.md` — branche `feat/CLI-004-config-loader`, scope `cli`

## Hors scope (NE PAS faire)
- Pas de `arc init` interactif (CLI-005)
- Pas d'écriture de `arc.config.yml` (CLI-005 + CLI-006/007/008 pour templates)
- Pas de génération de templates Docker Compose (CLI-006/007/008)
- Pas de résolution de secrets / vars d'env (interpolation `${...}`) — les valeurs sensibles restent telles quelles dans cette tâche
- Pas de cache disque du résultat
- Pas de `loadArcConfigSync` — async only (lecture disque potentiellement lente)
- Pas de hot-reload / watcher
- Pas d'utilisation dans une commande clipanion (l'intégration vient avec CLI-012 et CLI-015)

## Plan d'implémentation

### Sous-tâche 1 : Dépendance YAML + bootstrap dossier
- **Fichiers** : `packages/arc-cli/package.json`, `packages/arc-cli/src/config/index.ts`
- **Effort estimé** : 5 min
- **Détail** : `pnpm --filter @euglowlabs/arc-cli add yaml`. Choix : `yaml` (eemeli/yaml) — référence du parsing YAML en TS, supporte les positions de tokens pour les erreurs de syntaxe. Créer `src/config/index.ts` vide (rempli en sous-tâche 5).

### Sous-tâche 2 : ConfigError + formatZodError
- **Fichiers** : `packages/arc-cli/src/config/errors.ts`
- **Effort estimé** : 15 min
- **Détail** : Classe `ConfigError extends Error` avec :
  - `kind: "not-found" | "syntax" | "schema"` — discriminant
  - `path: string` — chemin du fichier source (toujours présent)
  - `issues?: string[]` — pour `kind: "schema"`
  - `cause?: Error` — l'erreur d'origine (yaml ou fs)
  - `toUserMessage(): string` — formate selon `kind` :
    - `not-found` : `"Config file not found: <path>"`
    - `syntax` : `"Invalid YAML at <path>:<line>:<col> — <message>"`
    - `schema` : `"Invalid arc.config.yml at <path>:\n  - <field>: <msg>\n  - <field>: <msg>"`
  - Helper `formatZodError(error: ZodError): string[]` qui transforme chaque issue en `"path.to.field: message"`.

### Sous-tâche 3 : loadArcConfig
- **Fichiers** : `packages/arc-cli/src/config/load.ts`
- **Effort estimé** : 20 min
- **Détail** : `export async function loadArcConfig(filePath: string): Promise<ArcConfig>` qui :
  1. `readFile(filePath, "utf8")` → catch `ENOENT` → throw `ConfigError("not-found")`
  2. `YAML.parse(raw, ...)` → catch `YAMLParseError` → extraire `linePos` → throw `ConfigError("syntax")`
  3. `arcConfigSchema.safeParse(parsed)` → si `!success` → `ConfigError("schema", issues = formatZodError(error))`
  4. Sur succès, retourner `result.data` (typé `ArcConfig` via inference).
  Imports : `node:fs/promises`, `yaml`, `@euglowlabs/arc-shared`, `./errors.js`.

### Sous-tâche 4 : Fixtures YAML
- **Fichiers** : 4 fichiers sous `packages/arc-cli/src/config/__fixtures__/`
- **Effort estimé** : 10 min
- **Détail** :
  - `valid-local.yml` — config minimale `target: local` (pas de provider)
  - `valid-vps.yml` — config complète avec provider Hetzner + projects + ollama models
  - `invalid-yaml.yml` — YAML cassé (ex: indentation incohérente, `:` manquant)
  - `invalid-schema.yml` — YAML valide mais `email` malformé + `target: azure` (deux issues)

### Sous-tâche 5 : Tests Vitest
- **Fichiers** : `packages/arc-cli/src/config/load.test.ts`, `packages/arc-cli/src/config/index.ts` (barrel re-export)
- **Effort estimé** : 25 min
- **Détail** : `import.meta.url` + `fileURLToPath` pour résoudre le chemin des fixtures. 5 cas :
  1. Valid minimal local → `target === "local"`, `provider === undefined`
  2. Valid complet vps → `target === "vps"`, `provider.plan === "cx32"`
  3. Fichier absent → `ConfigError`, `kind === "not-found"`, message contient le path
  4. YAML invalide → `ConfigError`, `kind === "syntax"`, `toUserMessage()` mentionne `:line:`
  5. Schéma invalide multi-issues → `ConfigError`, `kind === "schema"`, `issues.length >= 2`, message lisible
  Barrel `src/config/index.ts` re-exporte `loadArcConfig`, `ConfigError`.

### Sous-tâche 6 : Vérif + commit + PR
- **Fichiers** : aucun nouveau
- **Effort estimé** : 15 min
- **Détail** : Inclure aussi les artefacts pendants de CLI-003 (tasks/INDEX, tasks/current, archive). Ajustement `tsconfig.json` arc-cli si Vitest plante sur les fixtures (devrait être OK, tsconfig exclut déjà `**/*.test.ts` mais inclut tout `src/**/*` — vérifier que les `.yml` ne plantent pas tsc, normalement non car non importés). `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Branche `feat/CLI-004-config-loader`. Commit `feat(cli): load and validate arc.config.yml [CLI-004]`. Push, PR, attendre CI verte, merger.

## Scratchpad

### Décisions ouvertes — à valider avant de coder
- **Lib YAML** : `yaml` (eemeli/yaml) choisi car robust + erreurs avec positions. Alternatives rejetées : `js-yaml` (plus ancien, erreurs moins riches), `yaml-ast-parser` (low-level, overkill). Pas d'ADR (tooling local).
- **API throw vs Result** : on **throw** `ConfigError` (idiome Node, plus simple côté appelant). Si on avait un cadre fp, on utiliserait Result. À reconsidérer si on adopte un pattern Result global (hors scope CLI-004).
- **Async only** : `loadArcConfig` est async (utilise `node:fs/promises`). Pas de version sync — usage CLI très tolérant à l'async.
- **Pas d'interpolation `${VAR}`** : la spec infra §5.5 montre `api_token: ${CLOUDFLARE_TOKEN}`. Cette interpolation est volontairement reportée (probable nouvelle tâche CLI-004b ou intégrée à CLI-005). On accepte les `${...}` comme strings littérales pour l'instant.

### Notes
- Le chemin des fixtures : `import.meta.url` puis `fileURLToPath` + `path.dirname` + jointure. Pattern ESM standard.
- Au runtime : `tsc -p tsconfig.json` exclut déjà `**/*.test.ts`, donc le test ne sera pas inclus dans `dist/`. Les fixtures `.yml` ne sont pas importées comme modules, donc TS ne les voit pas.
- `arcConfigSchema.safeParse` retourne `{ success: false, error: ZodError }` — on n'utilise pas `.parse()` (qui throw une `ZodError` brute, moins ergonomique pour notre `ConfigError`).
