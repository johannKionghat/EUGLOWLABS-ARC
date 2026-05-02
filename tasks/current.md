# Tâche en cours : CLI-003 — Schéma zod de `arc.config.yml` (dans `arc-shared`)

## Statut
🟡 En cours — démarrée le 2026-05-02

## Objectif
Définir le **modèle de domaine** central du fichier `arc.config.yml` (cf. spec infra §5.5) en zod, dans `@euglowlabs/arc-shared`. C'est la **source de vérité typée** que toutes les commandes Phase 1 (deploy, status, init, project add, migrate) consommeront. Posé tôt, partagé par CLI / Agent / Cloud à terme.

## Critères d'acceptation
- [ ] `@euglowlabs/arc-shared` exporte un schéma `arcConfigSchema` (zod) couvrant tous les champs de spec infra §5.5
- [ ] Type TS `ArcConfig` exporté via `z.infer<typeof arcConfigSchema>`
- [ ] Sous-schémas séparés exportés : `providerSchema`, `dnsSchema`, `stackSchema`, `backupsSchema`, `servicesSchema`, `projectEntrySchema`
- [ ] Invariants cross-field : si `target: "vps"` alors `provider` est obligatoire ; si `target: "local"` alors `provider` est optionnel et ignoré
- [ ] Test Vitest avec ≥ 6 cas couverts : config valide minimale (local), config valide complète (vps), erreur si email invalide, erreur si target invalide, erreur si target=vps sans provider, erreur si subdomain dupliqué (entre projets)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` verts
- [ ] CI verte sur la PR
- [ ] PR mergée sur main

## Fichiers concernés (estimation)
- `packages/arc-shared/package.json` (modif — add `zod`)
- `packages/arc-shared/src/schemas/provider.ts` (création)
- `packages/arc-shared/src/schemas/dns.ts` (création)
- `packages/arc-shared/src/schemas/stack.ts` (création)
- `packages/arc-shared/src/schemas/backups.ts` (création)
- `packages/arc-shared/src/schemas/services.ts` (création)
- `packages/arc-shared/src/schemas/project.ts` (création)
- `packages/arc-shared/src/schemas/config.ts` (création — schéma racine + refine)
- `packages/arc-shared/src/schemas/index.ts` (création — barrel exports)
- `packages/arc-shared/src/index.ts` (modif — re-export `./schemas`)
- `packages/arc-shared/src/schemas/config.test.ts` (création — Vitest)

## ADRs liés
- ADR-0001 — Monorepo Turborepo (justifie la cohabitation `arc-shared`)
- ADR-0007 — Postgres partagé via Supabase (le schéma reflète qu'il y a une seule instance Supabase, pas une par projet)
- ADR-0009 — Dual target local/VPS (drive l'invariant target↔provider)

## Conventions à respecter
- `docs/04-conventions/coding-style.md` — TS strict, JSDoc sur exports, kebab-case fichiers
- `docs/04-conventions/testing.md` — Vitest collocated, cas limites couverts (null, vide, invalid)
- `docs/04-conventions/naming.md` — branche `feat/CLI-003-arc-config-schema`, scope `shared`

## Hors scope (NE PAS faire)
- Pas de **lecture/parse YAML** (CLI-004 — séparation lecture vs validation)
- Pas de **génération de templates** (CLI-006/007/008)
- Pas d'utilisation du schéma dans une commande (CLI-005 `arc init` viendra ensuite)
- Pas de validation runtime du fichier `arc.config.yml` réel — uniquement le schéma + tests sur des objets JS
- Pas de transformation snake_case → camelCase : on garde **snake_case** dans les schémas pour matcher 1:1 le YAML (boundary types)
- Pas de schéma marketplace (`arc-template.yml`) — c'est MARKET-001
- Pas de modification des packages CLI / Dashboard / Cloud / Agent

## Plan d'implémentation

### Sous-tâche 1 : Dépendance zod + bootstrap dossier
- **Fichiers** : `packages/arc-shared/package.json`, `packages/arc-shared/src/schemas/index.ts`
- **Effort estimé** : 5 min
- **Détail** : `pnpm --filter @euglowlabs/arc-shared add zod`. Créer `src/schemas/index.ts` (vide, sera rempli par les barrel exports en sous-tâche 7). Vérifier que zod est ajouté en `dependencies` (pas devDep, car le schéma sera consommé par les apps en runtime).

### Sous-tâche 2 : Sous-schémas — provider, dns, stack
- **Fichiers** : `src/schemas/provider.ts`, `src/schemas/dns.ts`, `src/schemas/stack.ts`
- **Effort estimé** : 25 min
- **Détail** :
  - `provider.ts` : `providerSchema` = `{ name: z.literal("hetzner"), plan: z.string().min(1), location: z.string().min(1), ssh_key: z.string().min(1) }`. Type `Provider`.
  - `dns.ts` : `dnsSchema` = `{ provider: z.literal("cloudflare"), zone: z.string().min(1), api_token: z.string().min(1), tunnel: z.boolean().default(false) }`. Type `DnsConfig`.
  - `stack.ts` : `stackSchema` = `{ paas: z.enum(["coolify","dokploy"]).default("coolify"), ai_stack: z.boolean().default(true), sandbox: z.boolean().default(true), monitoring: z.literal("uptime-kuma").default("uptime-kuma") }`. Type `StackConfig`.
  - JSDoc sur chaque schéma renvoyant à la spec infra §5.5.

### Sous-tâche 3 : Sous-schémas — backups, services, project
- **Fichiers** : `src/schemas/backups.ts`, `src/schemas/services.ts`, `src/schemas/project.ts`
- **Effort estimé** : 20 min
- **Détail** :
  - `backups.ts` : `backupsSchema` = `{ enabled: z.boolean().default(true), schedule: z.string().regex(cronRegex), retention_days: z.number().int().positive().max(365).default(7), remote: z.object({ provider: z.literal("r2"), bucket: z.string().min(1) }).optional() }`. Type `BackupsConfig`.
  - `services.ts` : `servicesSchema` = `{ ollama: z.object({ models: z.array(z.string().min(1)).default([]) }).default({ models: [] }) }`. Type `ServicesConfig`.
  - `project.ts` : `projectEntrySchema` = `{ name: z.string().regex(/^[a-z0-9-]+$/), repo: z.string().min(1), subdomain: z.string().regex(/^[a-z0-9-]+$/), branch: z.string().default("main") }`. Type `ProjectEntry`.

### Sous-tâche 4 : Schéma racine + invariant cross-field
- **Fichiers** : `src/schemas/config.ts`
- **Effort estimé** : 20 min
- **Détail** : `arcConfigSchema` z.object combinant tous les sous-schémas, avec `target: z.enum(["local","vps"])`, `email: z.string().email()`, `domain` validé via regex de domaine simple, `project: z.string().regex(/^[a-z0-9-]+$/)`, `projects: z.array(projectEntrySchema).default([])`. Ajouter `.superRefine((cfg, ctx) => …)` qui :
  - Si `cfg.target === "vps"` et `!cfg.provider` → ajoute une issue path `["provider"]`
  - Détecte les doublons dans `cfg.projects[].subdomain` → issue path `["projects"]`
  Type `ArcConfig = z.infer<typeof arcConfigSchema>`.

### Sous-tâche 5 : Barrel + re-export public
- **Fichiers** : `src/schemas/index.ts`, `src/index.ts`
- **Effort estimé** : 5 min
- **Détail** : `src/schemas/index.ts` exporte tous les schémas et types. `src/index.ts` ajoute `export * from "./schemas/index.js"` (en plus du `ARC_SHARED_VERSION` existant).

### Sous-tâche 6 : Tests Vitest
- **Fichiers** : `src/schemas/config.test.ts`
- **Effort estimé** : 25 min
- **Détail** : Au moins 6 cas couverts :
  1. ✅ Config valide minimale `target: "local"` (sans provider)
  2. ✅ Config valide complète `target: "vps"` avec provider, dns, stack, backups, services, projects
  3. ❌ `email` invalide → issue sur `["email"]`
  4. ❌ `target: "azure"` (valeur hors enum) → issue
  5. ❌ `target: "vps"` sans `provider` → issue sur `["provider"]`
  6. ❌ Deux projets avec même `subdomain` → issue sur `["projects"]`
  7. ✅ Bonus : valeurs par défaut appliquées (parse retourne `paas: "coolify"`, `tunnel: false`, `branch: "main"`)

### Sous-tâche 7 : Vérif + commit + PR
- **Effort estimé** : 15 min
- **Détail** : Inclure aussi les artefacts pendants de CLI-002 (tasks/INDEX, tasks/current, archive). `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Vérifier que `arc-cli` re-build sans casse (consomme `@euglowlabs/arc-shared` mais n'utilise pas encore les schémas). Branche `feat/CLI-003-arc-config-schema`. Commit `feat(shared): add zod schema for arc.config.yml [CLI-003]`. Push, PR, attendre CI verte, merger.

## Scratchpad

### Décisions ouvertes — à valider avant de coder
- **snake_case dans les schémas** : adopté pour matcher 1:1 le YAML, simplifie le futur load (CLI-004, pas de transformation). Type marqué "boundary type" en JSDoc. Si on veut camelCase côté code applicatif plus tard, on ajoutera un mapper séparé. Pas d'ADR nécessaire (convention locale, réversible).
- **Localisation de `arcConfigSchema`** : dans `arc-shared`, pas `arc-cli`. Justifié : Agent et Cloud le consommeront aussi (validation côté serveur). ADR-0001 (monorepo) couvre.
- **Validation `domain`** : regex simple `/^[a-z0-9.-]+\.[a-z]{2,}$/i`, pas full RFC. La spec n'exige pas une validation parfaite ; on accepte le compromis pour éviter une dépendance lourde.
- **`tunnel: true` autorisé en target=vps** : on ne bloque pas, l'utilisateur peut vouloir un tunnel sur VPS aussi (cas d'étude). À documenter en JSDoc, pas dans `superRefine`.

### Notes
- zod 3.x stable. Pas besoin de zod 4 alpha.
- Pas de dépendance Node native dans `arc-shared` → pas besoin de `@types/node` ici.
- Le test sera `Vitest` collocated `src/schemas/config.test.ts` selon `testing.md`.
- Les sous-schémas sont des objets `z.object(...)` *sans* `.passthrough()` ni `.strict()` par défaut. Décision : `.strict()` sur le schéma racine pour bloquer les clés inconnues (évite typos silencieux dans `arc.config.yml`). À acter en sous-tâche 4.
