# Tâche : DNS-001 — Cloudflare API records DNS automatiques

## Statut
🟢 Prête pour archive — sous-tâches 1 → 3 livrées le 2026-05-07.

### Recap des commits poussés sur `origin/main`

| Commit | Sous-tâche | Sujet |
|---|---|---|
| `524eac8` | 1 | Cloudflare API client + types Zod + 5 erreurs typées (`override readonly cause`) |
| `8be1530` | 2 / Phase A | `loadCloudflareCredentials` + `resolveZoneId` (strict match) + `arc dns list` + `arc dns remove` |
| `998a468` | 2 / Phase B | `arc dns add` (collision detection + `--force` delete-then-create) + factor `test-helpers.ts` |
| _(à venir)_ | 3 | finalize DNS-001 (README enrichi + criteria check + scratchpad) |

### Bilan validation finale (sous-tâche 3)

- `ansible-lint setup.yml roles/` → **0 violation** sur 24 fichiers (inchangé — DNS-001 = scope TS, pas Ansible).
- `pnpm test` → **164 / 164 verts** (144 → 164, +20 tests Cloudflare répartis : 5 client + 5 credentials + 3 list + 3 remove + 4 add).
- `pnpm lint` → Biome 120 fichiers, no fixes.
- `pnpm typecheck` → tous packages OK (vert depuis `a63ecd1`).
- README enrichi : section « DNS commands » avec Configuration / List / Add / Remove / Notes (zone resolution priority, `--dry-run` semantics, default comment).

## Objectif
Livrer 3 commandes CLI `arc dns add` / `arc dns list` / `arc dns remove` qui interagissent avec l'API Cloudflare v4 pour créer/lister/supprimer des records DNS (A, CNAME, TXT) dans la zone du domaine ARC. Compatible mode `--dry-run` pour audit sans token et exécution offline en CI. Token operator-managed dans `~/.arc/credentials/cloudflare.env` (cohérent `r2.env` / `local-ai.env` du backups role).

Cette tâche est la dernière brique infra avant E2E-001 — elle débloquera le déploiement de records `A wildcard` pointant l'IP publique du VPS sur le domaine de l'opérateur (cf. `docs/install-without-public-ip.md` pour le cas tunneled).

## Critères d'acceptation

### Module `src/cloudflare/` (sous-tâche 1)
- [x] Client `CloudflareClient` avec 4 méthodes : `listZones`, `listDnsRecords`, `createDnsRecord`, `deleteDnsRecord` (`fetch()` natif, Bearer auth)
- [x] Types Zod : `Zone`, `DnsRecord`, `CreateDnsRecord` (`.strict()` sur input, permissif sur output pour résilience aux ajouts upstream), `CloudflareApiResponseSchema` envelope
- [x] 5 erreurs typées : `CloudflareApiError` base + `CloudflareAuthError` (401/403) + `CloudflareRateLimitError` (429) + `CloudflareNotFoundError` (404) + `CloudflareValidationError` (400)
- [x] `override readonly cause` sur `CloudflareApiError` (anti-TS4114, leçon `a63ecd1` INSTALL-002)
- [x] `private request()` centralisant fetch / JSON parsing / envelope validation / HTTP→error mapping (DRY)
- [x] 5 tests `vi.spyOn(globalThis, "fetch")` : 1 success + 4 mappings d'erreur

### Commandes CLI (sous-tâche 2)
- [x] `arc dns list [--zone] [--type] [--name] [--json] [--credentials]` — table par défaut, JSON via flag
- [x] `arc dns add <name> --type --content [--ttl] [--comment] [--proxied] [--force] [--dry-run] [--zone] [--credentials]`
- [x] `arc dns remove <name> --type [--content] [--zone] [--dry-run] [--credentials]` — disambiguation par `--content`, refus si 0 ou >1 match
- [x] `--dry-run` sur `add` et `remove` : skip credentials + skip API entirely (CI-friendly)
- [x] `loadCloudflareCredentials()` (`~/.arc/credentials/cloudflare.env`, KEY=VALUE) avec `CloudflareCredentialsMissingError` typée
- [x] `resolveZoneId()` : précédence `--zone` > `CLOUDFLARE_ZONE_ID` env > heuristique last-2-labels avec **strict name match** (défensif fuzzy API)
- [x] Collision detection sur `add` : refuse sans `--force`, message multi-line avec 3 suggestions (replace / remove / list)
- [x] `--force` = delete-then-create loop sur `existing` (gère `existing.length > 1`)
- [x] Default comment `"managed-by:arc"`, omit avec `--comment=""`
- [x] Validation type via `DnsRecordTypeSchema.safeParse` (single source of truth Zod)
- [x] Validation TTL `1` ou `60..86400`, `--proxied` incompatible avec `TXT`
- [x] 11 tests via `runFromArgs` (cohérent `cli.test.ts`) : 4 credentials + 3 list + 3 remove + 4 add — `tempCreds` / `run` / `mockJson` factorés dans `test-helpers.ts`
- [x] Commandes enregistrées dans `src/cli.ts`

### Validation finale (sous-tâche 3)
- [x] `pnpm test` → **144 → 164 verts** (+20 tests Cloudflare)
- [x] `pnpm lint` → Biome no fixes (120 fichiers)
- [x] `pnpm typecheck` → tous packages OK
- [x] `ansible-lint` → 0 violation maintenu (no impact, scope TS uniquement)
- [x] `packages/arc-cli/README.md` enrichi avec section « DNS commands » : Configuration + List/Add/Remove avec exemples + Notes (zone resolution priority, `--dry-run`, default comment)
- [ ] **Smoke runtime** (création réelle d'un record A/CNAME/TXT avec un vrai token + auto-discovery réelle + cleanup) _(reporté à E2E-001)_
- [ ] Test runtime de la collision detection sur record existant côté Cloudflare _(reporté à E2E-001)_
- [ ] Round-trip add → list → remove → list sur vrai zone Cloudflare _(reporté à E2E-001)_

## Fichiers concernés (estimation : 10 fichiers, dont 8 nouveaux)

| Fichier | Action |
|---|---|
| `packages/arc-cli/src/dns/client.ts` | création (NEW) |
| `packages/arc-cli/src/dns/client.test.ts` | création (NEW) |
| `packages/arc-cli/src/dns/add.ts` | création (NEW) |
| `packages/arc-cli/src/dns/add.test.ts` | création (NEW) |
| `packages/arc-cli/src/dns/list.ts` | création (NEW) |
| `packages/arc-cli/src/dns/list.test.ts` | création (NEW) |
| `packages/arc-cli/src/dns/remove.ts` | création (NEW) |
| `packages/arc-cli/src/dns/remove.test.ts` | création (NEW) |
| `packages/arc-cli/src/cli.ts` | modif (register 3 commands) |
| `packages/arc-cli/README.md` | modif (section DNS commands) |

⚠️ **10 fichiers** = au-dessus de la limite haute CLAUDE.md (« > 5 → STOP, demander confirmation »). Justifié par la nature « feature module CLI » (1 client + 3 commandes + 4 tests = strucutre minimale cohérente, pattern repris de `src/projects/`). Si la sous-tâche 2 déborde, je redécoupe en 2a (add seul) + 2b (list+remove). **Tu valides cette dérogation à 10 fichiers ?**

## ADRs liés

- **ADR-0001** — Monorepo Turborepo + pnpm workspaces.
- **ADR-0002** — CLI : Bun + clipanion + zod, single binary via `bun build --compile`.
- **ADR-0011** — Critères acceptance (DNS records ne sont pas critère explicite mais implicite pour `arc setup --apply` complet).
- **ADR-0015** — Layout `~/.arc/credentials/`. `cloudflare.env` rejoint `r2.env` + `local-ai.env`.

## Conventions à respecter

- `coding-style.md` — TypeScript strict, **zéro `any`**, nommage `CamelCase` pour types/classes, `camelCase` pour functions/variables.
- `testing.md` — Vitest, `vi.spyOn(globalThis, 'fetch')` pour HTTP (cohérent code existant `src/projects/coolify.ts`), pas de MSW.
- `naming.md` — TASK-ID `[DNS-001]` dans tous les commits.
- `pr-review.md` — 1 PR < 2h.

## Hors scope (NE PAS faire)

- Token Cloudflare réel obligatoire — mode `--dry-run` couvre les tests offline.
- Smoke runtime (création réelle de records) — reporté à E2E-001.
- Types DNS au-delà de A/CNAME/TXT (AAAA, MX, SRV, CAA…) — CLI gap futur.
- `arc dns sync` déclaratif (input file → reconciliation) — CLI gap futur.
- Records partagés entre plusieurs zones (auto-detection multi-zones) — pas en MVP.
- Public Suffix List complet pour zone resolution — heuristique simple (last 2 labels, walk up) suffit pour MVP. CLI gap pour PSL si besoin.
- Bulk operations (`arc dns add --from-file=*.csv`) — futur.
- Webhooks Cloudflare ou listeners — out of scope CLI.
- Intégration directe avec rôle Ansible — DNS-001 est CLI, pas Ansible. L'opérateur lance `arc dns add` après `arc setup --apply`.

## Décisions actées avant code (cadrage 2026-05-07)

### Décisions produit (D1-D5)

- **D1** — Stockage token : `~/.arc/credentials/cloudflare.env` (KEY=VALUE, mode 0600). Cohérent avec `r2.env` / `local-ai.env`.
- **D2** — Zone identification combinée : `CLOUDFLARE_ZONE_ID` (env file) si présent, sinon auto-discovery API via `GET /zones?name=<root>`.
- **D3** — Types de records MVP : `A` + `CNAME` + `TXT` uniquement.
- **D4** — Reconciliation impérative (pas de tracker de state local). `add` ne overwrite jamais sans `--force`. `--dry-run` partout.
- **D5** — 3 commandes CLI MVP : `add`, `list`, `remove`. `sync` déclaratif → CLI gap.

### Questions tranchées (Q-A, Q-B, Q-C)

- **Q-A — Mode `--dry-run` partout** (option b décidée) : permet code + tests sans token réel maintenant. Smoke runtime reporté à E2E-001.
- **Q-B — clipanion** confirmé : déjà `4.0.0-rc.4` dans `package.json`, pattern bien établi.
- **Q-C — `vi.spyOn(globalThis, 'fetch')`** pour tests HTTP : cohérent code existant (`src/projects/coolify.ts`), zéro nouvelle dev-dependency. MSW = CLI gap futur si on multiplie les API externes.

## Plan d'implémentation

### Sous-tâche 1 : Client API + types Zod + erreurs ✅
- Fichiers livrés : 4 dans `src/cloudflare/` (co-locés, pas `__tests__/`) — `errors.ts`, `types.ts`, `client.ts`, `client.test.ts`
- Détail livré :
  - **5 erreurs typées** (`errors.ts`) : `CloudflareApiError` base + `CloudflareAuthError` (401/403) + `CloudflareRateLimitError` (429) + `CloudflareNotFoundError` (404) + `CloudflareValidationError` (400). `override readonly cause` sur la base (anti-TS4114, leçon `a63ecd1`).
  - **Schémas Zod** (`types.ts`) : `ZoneSchema` + `DnsRecordSchema` permissifs (Cloudflare ajoute des champs au fil du temps), `CreateDnsRecordSchema.strict()` pour input contrôlé. `CloudflareApiResponseSchema` pour valider l'envelope `{ success, errors, messages, result }`.
  - **Class `CloudflareClient`** (`client.ts`) : 4 méthodes (`listZones`, `listDnsRecords`, `createDnsRecord`, `deleteDnsRecord`) + `private request()` centralisant fetch + JSON parsing + envelope validation + HTTP→error mapping. `baseUrl` overridable via `opts.baseUrl ?? process.env.CLOUDFLARE_API_BASE_URL ?? DEFAULT`.
  - **5 tests Vitest** (`client.test.ts`) avec `vi.spyOn(globalThis, "fetch")` : 1 success (`listZones`) + 4 mappings d'erreur (401→Auth, 429→RateLimit, 404→NotFound, 400→Validation).
  - `loadCloudflareCredentials()` déféré à sous-tâche 2 (cohérent avec LIVRABLES 4 fichiers).
  - 2 itérations Biome formatter (compactage signatures multi-lignes via `pnpm lint:fix`).
- Validation : `pnpm test` 144 → **149 verts**. `pnpm lint` clean. `pnpm typecheck` OK.

### Sous-tâche 2 : Commandes CLI add/list/remove + register

#### Phase A — credentials + list + remove ✅
- Fichiers livrés : `src/cloudflare/credentials.ts` + `.test.ts`, `src/commands/dns/list.ts` + `.test.ts`, `src/commands/dns/remove.ts` + `.test.ts`, `src/cli.ts` (register list + remove).
- Détail livré :
  - `loadCloudflareCredentials()` : KEY=VALUE parser défensif sur `~/.arc/credentials/cloudflare.env`. Erreur `CloudflareCredentialsMissingError` si fichier absent ou token vide.
  - `resolveZoneId()` : précédence `--zone` > `CLOUDFLARE_ZONE_ID` env > heuristique last-2-labels avec `find(z => z.name === candidate)` strict (défensif fuzzy API).
  - `arc dns list` : table fixed-width par défaut (CLI gap padEnd noté), `--json` flag, filtres `--type` / `--name`, `--zone` override.
  - `arc dns remove <name> --type=...` : `--dry-run` skip total (creds + API), `--content` disambiguation, refuse si 0 ou >1 match. Pas de `--force` en MVP (CLI gap noté).
  - Tests via `runFromArgs()` pattern (cohérent `cli.test.ts`), `tempCreds()` helper local, `vi.spyOn(globalThis, "fetch")`.
  - 1 itération formatter Biome (compactage signatures + non-null assertion → destructuring `[target, ...others]`).
- Validation : `pnpm test` 149 → **160 verts** (+11). `pnpm lint` clean. `pnpm typecheck` OK.

#### Phase B — add (collision detection + --force) ✅
- Fichiers livrés : `src/commands/dns/add.ts` + `.test.ts`, `src/cli.ts` (register add), `src/commands/dns/test-helpers.ts` (NEW — extraction des duplicats `tempCreds` / `run` / `mockJson`), `src/commands/dns/list.test.ts` + `remove.test.ts` (refactor — import depuis test-helpers).
- Détail livré :
  - `DnsAddCommand` : positional `<name>` + `--type`/`--content` (required), `--ttl`/`--comment`/`--proxied`/`--force`/`--dry-run`/`--zone`/`--credentials`.
  - Validation : type via `DnsRecordTypeSchema.safeParse`, TTL `1` ou `60..86400`, `--proxied` incompatible avec `TXT`.
  - Collision : `listDnsRecords(name+type)` → si match sans `--force` : multi-line error avec 3 suggestions (replace/remove/list).
  - `--force` : delete-then-create loop sur `existing` (gère `existing.length > 1`).
  - Default comment `"managed-by:arc"`, `--comment=""` omit, `--comment=X` use X.
  - Output : `Created` ou `Replaced ... (deleted previous record id: ...)`.
  - Factor `test-helpers.ts` : ferme le CLI gap Phase A « 3e duplication tempCreds ».
  - 2 itérations Biome (`useTemplate` + `noUnusedTemplateLiteral` sur l'erreur multi-line → consolidée en 1 seule template literal).
- Validation : `pnpm test` 160 → **164 verts** (+4). `pnpm lint` clean. `pnpm typecheck` OK.

### Sous-tâche 2 ✅ COMPLÈTE (Phase A + Phase B)

### Sous-tâche 3 : Validation finale + README
- Fichiers : `packages/arc-cli/README.md` (modif — section DNS) + scratchpad
- Effort estimé : ~20 min
- Détail :
  - Run `pnpm test` → ~155 verts (144 + 11 nouveaux).
  - Run `pnpm lint && pnpm typecheck` → verts.
  - Run `ansible-lint setup.yml roles/` → 0 violation maintenu (no impact, scope TS).
  - **README enrichi** : section « DNS commands » avec format `cloudflare.env`, exemples `arc dns add foo.example.com --type=A --content=1.2.3.4 --dry-run`, `arc dns list --type=A`, `arc dns remove foo.example.com --type=A`, mention du mode `--dry-run` partout.
  - Pré-archive : statut → 🟢, recap commits, bilan validation finale.

## Notes pour E2E-001 (à lire au démarrage de E2E-001)

- DNS-001 livre les commandes CLI en mode offline (`--dry-run` + tests mockés). E2E-001 valide :
  - Récupération réelle des zones via `arc dns list --zone=<test-domain>` (token requis).
  - Création réelle d'un record A test (ex: `e2e-test-<timestamp>.example.com → 1.2.3.4`) puis cleanup.
  - Round-trip add → list (verify present) → remove → list (verify absent).
  - Mode `--dry-run` ne touche jamais l'API (vérification : 0 appel HTTP via `tcpdump` ou Cloudflare audit log).
  - Test des 3 erreurs : auth invalide, zone inconnue, record collision sans `--force`.

## Scratchpad
- _(empty — Claude met à jour pendant le travail)_

## CLI gaps
- **Validation Zod côté input client** : si `arc dns add` accepte plus tard un input externe (YAML/JSON via flag `--from-file`), valider via `CreateDnsRecordSchema.parse()` avant POST côté `client.createDnsRecord()`. Aujourd'hui les inputs viennent uniquement des flags clipanion (string-typed), validation manuelle suffit.
- **Distribution sans test code** : si on veut zero test code dans le binaire `arc` final, ajouter pattern exclude `**/{test-helpers,*.test}.ts` dans le `tsconfig` de build (séparer typecheck vs build configs). Aujourd'hui `test-helpers.ts` est compilé dans `dist/` mais tree-shaken par `bun build --compile`.
- **`--force` sur `remove`** : retiré en MVP (no-op = false promesse, scope creep). Quand confirmation interactive sera ajoutée à `arc dns remove`, introduire `--force` pour skipper le prompt.
- **Test helper `tempCreds()` dupliqué** : présent dans `list.test.ts` + `remove.test.ts`. Si Phase B ajoute une 3e duplication dans `add.test.ts`, factoriser en helper partagé (ex: `src/commands/dns/_test-helpers.ts`).
- **Table layout `padEnd(38/35)`** : misalignment sur noms > 38 chars ou content > 35 chars (longs TXT, longs subdomains). Switch `cli-table3` ou colonnes dynamiques si demande utilisateur.
- **Headers normalization** dans `CloudflareClient.request()` : actuellement `{ ...init.headers }` assume un plain object. Si un appelant passe `new Headers(...)` ou un tuple `[[k,v]]`, le spread silently ignore. Fragile à long terme. À durcir si on étend les usages ou si on ajoute un middleware/interceptor.
- **DNS-001 livré sans token Cloudflare réel**. Validation runtime (création réelle d'un record A/CNAME/TXT et cleanup) reportée à E2E-001.
- **`arc dns sync` déclaratif** (input file YAML/JSON → reconciliation propre vs. records actuels) — futur, scope CLI gap si demande user.
- **Public Suffix List** pour zone resolution robuste (test.s3.amazonaws.com vs example.co.uk vs example.com) — heuristique simple en MVP (last 2 labels, walk up). CLI gap si besoin domaines complexes.
- **Types DNS étendus** (AAAA, MX, SRV, CAA, TLSA…) — MVP A/CNAME/TXT seulement. Étendre si demande user.
- **Bulk operations** (`arc dns add --from-file=*.csv`) — futur.
- **MSW (Mock Service Worker)** comme alternative à `vi.spyOn(globalThis, 'fetch')` si on multiplie les API externes (DNS + GitHub + Cloudflare R2 admin + ...). Choisi `vi.spyOn` en MVP pour zéro dette.
- **Hérités d'001a/b/c (12 entrées)** à traiter au moment opportun — cf. `tasks/completed/2026-05-07-ANSIBLE-001c.md`.
