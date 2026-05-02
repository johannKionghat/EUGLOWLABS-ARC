# Tâche en cours : CLI-006 — Génération templates eta : `docker-compose.prod.yml`, `.env`

## Statut
🟡 En cours — démarrée le 2026-05-02

## Objectif
Premier maillon de la chaîne **génération de stack** : à partir d'un `ArcConfig` chargé (CLI-004), produire deux fichiers générés — `docker-compose.prod.yml` (réseau `prod_net` + Uptime Kuma + monitoring local) et `.env` (variables partagées + placeholders pour secrets) — via le moteur de templates **eta** (cf. spec infra §5.3 et §4.1). CLI-007 (sandbox) et CLI-008 (agents) suivront le même pattern.

## Critères d'acceptation
- [ ] `eta` ajouté en dep runtime de `@euglowlabs/arc-cli`
- [ ] Template eta `docker-compose.prod.yml.eta` versionné, rendu via `eta.renderString` ou équivalent file-based
- [ ] Template eta `env.eta` versionné
- [ ] Fonctions exportées `generateProdCompose(cfg): string` et `generateEnvFile(cfg): string` qui acceptent un `ArcConfig` typé
- [ ] La sortie `docker-compose.prod.yml` contient :
  - Un réseau `prod_net` (driver bridge)
  - Un service `uptime-kuma` (image officielle, port interne 3001, label Traefik basé sur `${BASE_DOMAIN}`)
  - Un volume nommé pour Uptime Kuma
- [ ] La sortie `.env` contient `BASE_DOMAIN`, `ADMIN_EMAIL`, `CF_API_TOKEN`, `JWT_SECRET` (placeholder), `POSTGRES_PASSWORD` (placeholder), avec entêtes de commentaire indiquant ce qui doit être rempli
- [ ] Le compose généré passe `docker compose -f - config` côté validation (pas testé en CI mais smoke test local)
- [ ] ≥ 4 tests Vitest : output prod compose contient les clés attendues pour local + vps, output env reflète domain/email du config, snapshot stable
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` verts
- [ ] CI verte sur la PR
- [ ] PR mergée sur main

## Fichiers concernés (estimation)
- `packages/arc-cli/package.json` (modif — add `eta`)
- `packages/arc-cli/src/templates/__templates__/docker-compose.prod.yml.eta` (création)
- `packages/arc-cli/src/templates/__templates__/env.eta` (création)
- `packages/arc-cli/src/templates/render.ts` (création — wrapper `renderTemplate(path, data)` autour d'eta avec résolution `import.meta.url`)
- `packages/arc-cli/src/templates/prod-compose.ts` (création — `generateProdCompose(cfg)`)
- `packages/arc-cli/src/templates/env.ts` (création — `generateEnvFile(cfg)`)
- `packages/arc-cli/src/templates/index.ts` (création — barrel)
- `packages/arc-cli/src/templates/prod-compose.test.ts` (création)
- `packages/arc-cli/src/templates/env.test.ts` (création)

## ADRs liés
- ADR-0001 — Monorepo Turborepo
- ADR-0002 — Bun runtime CLI / clipanion
- ADR-0005 — Coolify n'est jamais forké : ce compose maison ajoute uniquement ce que Coolify ne fournit pas (Uptime Kuma + monitoring)
- ADR-0008 — Trois réseaux Docker isolés : ici `prod_net` (autres réseaux dans CLI-007/008)

## Conventions à respecter
- `docs/04-conventions/coding-style.md` — TS strict, JSDoc, kebab-case fichiers, pas d'`any`
- `docs/04-conventions/testing.md` — Vitest collocated, cas limites couverts
- `docs/04-conventions/naming.md` — branche `feat/CLI-006-prod-templates`, scope `cli`

## Hors scope (NE PAS faire)
- Pas de templates **sandbox** (CLI-007) ni **agents** (CLI-008)
- Pas d'**installation de Coolify** ni `local-ai-packaged` (CLI-012/013)
- Pas de **génération réelle de secrets** (`JWT_SECRET`, `POSTGRES_PASSWORD`) — placeholders littéraux. Génération aléatoire reportée à une tâche dédiée.
- Pas d'**écriture sur disque** depuis cette tâche — les fonctions retournent des `string`. L'écriture (et l'orchestration) viendra avec `arc deploy` (CLI-012).
- Pas d'**applications utilisateur** (`projects[]`) dans le compose — les apps sont déployées via Coolify, pas via notre compose maison
- Pas d'**interpolation `${VAR}`** dans le `.env` — les vars d'env Docker sont laissées telles quelles (le `.env` les définit ; Compose les interpole au runtime)
- Pas de **commande clipanion** (l'exposition CLI viendra avec CLI-012/013)

## Plan d'implémentation

### Sous-tâche 1 : Dépendance eta + bootstrap dossier
- **Fichiers** : `packages/arc-cli/package.json`, `src/templates/index.ts`
- **Effort estimé** : 5 min
- **Détail** : `pnpm --filter @euglowlabs/arc-cli add eta`. Créer `src/templates/index.ts` (barrel vide à remplir en sous-tâche 5). Vérifier que les fichiers `.eta` sont copiés au build (`tsc` ne les copie pas par défaut — décision à prendre en sous-tâche 3 : embarquer le contenu via raw import OU utiliser `import.meta.url` pour résoudre le path à l'exécution).

### Sous-tâche 2 : Template eta `docker-compose.prod.yml.eta`
- **Fichiers** : `src/templates/__templates__/docker-compose.prod.yml.eta`
- **Effort estimé** : 20 min
- **Détail** : YAML eta avec :
  - Réseau `prod_net` (`driver: bridge`)
  - Volume `arc_uptime_kuma_data`
  - Service `uptime-kuma` (`image: louislam/uptime-kuma:1`, restart, volumes, networks, labels Traefik utilisant `${BASE_DOMAIN}` interpolé par Compose runtime — eta n'inject que `<%= it.cfg.domain %>` dans le hostname final)
  - Header de commentaire `# Generated by arc deploy — do not edit by hand`. Indenter à 2 espaces, suivre style spec-infra §19 et §20.

### Sous-tâche 3 : Wrapper `renderTemplate`
- **Fichiers** : `src/templates/render.ts`
- **Effort estimé** : 15 min
- **Détail** : `renderTemplate(relativePath: string, data: Record<string, unknown>): string`. Résolution du path via `fileURLToPath(import.meta.url)` + `path.join` pour atteindre `__templates__/`. Utilise `eta` API simple (`Eta.renderStringAsync` ou `renderString`). **Décision build** : utiliser `readFileSync` + `eta.renderString(content, data)` pour éviter la complication du copy-of-non-ts-files. Adapter `tsconfig.json` pour copier les `.eta` via `assets` ? Non, on lit via `readFileSync(import.meta.url + '../__templates__/...')` qui résout dans `dist/templates/__templates__/`. Il faudra un script `cp -r src/templates/__templates__ dist/templates/__templates__` dans le `build` script ou bien un loader runtime depuis `src` directement. **Choix** : ajouter un `postbuild` qui copie les eta dans `dist/`. Implémenté via `cpx` ou simple commande Node `--input-type=module`. Si trop complexe, fallback : embarquer le contenu via une chaîne TS.

### Sous-tâche 4 : Générateurs `generateProdCompose` et `generateEnvFile`
- **Fichiers** : `src/templates/prod-compose.ts`, `src/templates/env.ts`, `src/templates/__templates__/env.eta`
- **Effort estimé** : 20 min
- **Détail** :
  - `generateProdCompose(cfg: ArcConfig): string` appelle `renderTemplate("docker-compose.prod.yml.eta", { cfg })`
  - `generateEnvFile(cfg: ArcConfig): string` appelle `renderTemplate("env.eta", { cfg })`
  - `env.eta` produit :
    ```
    # Generated by arc deploy — fill secrets before first deploy
    BASE_DOMAIN=<%= it.cfg.domain %>
    ADMIN_EMAIL=<%= it.cfg.email %>
    # Cloudflare DNS
    CF_API_TOKEN=<%= it.cfg.dns.api_token %>
    # Generated at install time — replace before first deploy
    JWT_SECRET=__REPLACE_ME__
    POSTGRES_PASSWORD=__REPLACE_ME__
    ```
  - JSDoc sur les deux fonctions, pointant vers spec-infra §5.3.

### Sous-tâche 5 : Tests Vitest + barrel
- **Fichiers** : `src/templates/prod-compose.test.ts`, `src/templates/env.test.ts`, `src/templates/index.ts`
- **Effort estimé** : 25 min
- **Détail** : 4-5 cas :
  - `generateProdCompose` sur config local → contient `prod_net`, `uptime-kuma`, `louislam/uptime-kuma`, label Traefik avec le domaine
  - `generateProdCompose` sur config vps → idem (les valeurs varient peu, validation que la génération est stable)
  - `generateEnvFile` sur config → contient `BASE_DOMAIN=<domain>`, `ADMIN_EMAIL=<email>`, `CF_API_TOKEN=<token>`, `JWT_SECRET=__REPLACE_ME__`
  - Output ne contient **aucun** placeholder eta non résolu (pas de `<%= ... %>` résiduel)
  Barrel `src/templates/index.ts` exporte les deux générateurs. Test help reste inchangé (pas de nouvelle commande dans cette tâche).

### Sous-tâche 6 : Vérif + commit + PR
- **Fichiers** : aucun nouveau
- **Effort estimé** : 15 min
- **Détail** : Inclure les artefacts pendants de CLI-005 + correction de coquille `genericName` dans l'archive. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Vérifier que `dist/templates/__templates__/*.eta` existe après build (postbuild step, sous-tâche 3). Smoke test : `node -e "import('@euglowlabs/arc-cli/templates').then(m => console.log(m.generateProdCompose(...)))"` (manuel). Branche `feat/CLI-006-prod-templates`. Commit `feat(cli): generate prod compose and .env from arc config [CLI-006]`. Push, PR, attendre CI verte, merger.

## Scratchpad

### Décisions ouvertes — à valider avant de coder
- **Résolution des fichiers `.eta`** : 2 options.
  1. **`readFileSync` + chemin résolu via `import.meta.url`** (cohérent avec les fixtures CLI-004), nécessite une étape `postbuild` qui copie `__templates__/` dans `dist/`.
  2. **Embarquer le contenu** dans des constantes TS (`export const PROD_COMPOSE_TEMPLATE = "..."`). Pas de postbuild, mais perd la lisibilité YAML/syntax-highlight côté template.
  Choix : **option 1** (readFileSync + postbuild). Plus lisible long-terme, et le pattern sera réutilisé pour CLI-007/008. Le postbuild est une simple commande `node --input-type=module` ou un mini-script.
- **Génération de secrets aléatoires** : reportée. Les placeholders `__REPLACE_ME__` rendent l'intention explicite et forcent l'utilisateur à les remplir avant `arc deploy`.
- **Apps utilisateur** (`projects[]`) absentes du compose : assumé. Coolify est responsable du déploiement Git push → app Next.js. Le compose maison se cantonne aux services qui ne passent pas par Coolify.
- **Pas d'interpolation `${VAR}` côté eta** : on laisse Compose interpoler `${BASE_DOMAIN}` à son runtime, pas eta. Donc dans le template eta, on écrit littéralement `${BASE_DOMAIN}` (pas `<%= ... %>`) pour que Compose le voie.

### Notes
- `eta` 3.x fonctionne en ESM natif, compat Node + Bun.
- `import.meta.url` côté Node ESM = path file://... Il faut `fileURLToPath` pour avoir un path POSIX/Windows-friendly.
- Postbuild minimal : `"build": "tsc -p tsconfig.json && node ../../scripts/copy-templates.mjs arc-cli"` ou un simple `cp -r` cross-platform via `cpx`. À trancher en sous-tâche 3.
- Le test ne charge pas docker compose réellement — on se contente d'asserts string. La validation Compose est out of CI scope (nécessiterait Docker).
