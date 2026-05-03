# Refactor ADR-0012 — Inventaire (Phase A)

> Date : 2026-05-03
> Source : `tasks/cancelled/` non créé encore. Backup : `backup/before-adr-0012`.
> Modèle cible : **single-machine install** (l'utilisateur SSH dans son VPS, lance `arc setup` sur place — agnostique provider). Supersede ADR-0009 (dual `target: local | vps`).

Aucune modification de code n'a été faite — c'est un rapport.

---

## A.1 — Inventaire EXHAUSTIF

### Code source `packages/`

| Fichier | LoC | Lignes / éléments concernés | Rôle |
|---|---|---|---|
| `packages/arc-cli/src/exec/types.ts` | 83 | tout (interface `ExecutionAdapter`, JSDoc qui mentionne `LocalAdapter`/`VPSAdapter`/`target: local | vps`) | Contrat d'adapter dual local/vps |
| `packages/arc-cli/src/exec/local.ts` | 72 | `LocalAdapter` (entier) | Impl execa + node:fs (machine opérateur) |
| `packages/arc-cli/src/exec/vps.ts` | 109 | `VPSAdapter` (entier), import `node-ssh`, JSDoc target=vps | Impl SSH distante via node-ssh |
| `packages/arc-cli/src/exec/provision.ts` | 76 | `provisionHetzner`, `ProvisionedVps`, `ProvisionHetznerOptions`, fetch Hetzner API | Provisioning VPS Hetzner externe |
| `packages/arc-cli/src/exec/mock.ts` | ~85 | `MockAdapter` (entier) | Test adapter — toujours utile |
| `packages/arc-cli/src/exec/index.ts` | 13 | exports `LocalAdapter`, `VPSAdapter`, `provisionHetzner`, `MockAdapter` + types | Barrel |
| `packages/arc-cli/src/exec/vps.test.ts` | 23 | tout | Tests VPSAdapter |
| `packages/arc-cli/src/exec/local.test.ts` | 65 | tout (5 tests cross-platform) | Tests LocalAdapter (à conserver — devient l'adapter unique) |
| `packages/arc-cli/src/migrate/migrate.ts` | 84 | tout (orchestration source→target) | Migration local → VPS via 2 adapters |
| `packages/arc-cli/src/migrate/migrate.test.ts` | 49 | tout | Test migrate dual-MockAdapter |
| `packages/arc-cli/src/commands/migrate.ts` | 63 | tout (importe `LocalAdapter`+`VPSAdapter`, options `--ssh-user`/`--ssh-key`/`--to`/`--from`) | Commande `arc migrate` |
| `packages/arc-cli/src/tunnel/cloudflared.ts` | 60 | tout (`renderCloudflaredConfig`, `setupTunnel`) | Cloudflare Tunnel pour mode local |
| `packages/arc-cli/src/tunnel/cloudflared.test.ts` | 39 | tout | Tests tunnel |
| `packages/arc-cli/src/init/prompts.ts` | 124 | l. 43-50 (select `target` local|vps), l. 88 (`tunnel: target === "local"`), l. 92-120 (branchement vps → provider Hetzner) | Prompts interactifs `arc init` |
| `packages/arc-cli/src/commands/deploy.ts` | ~80 | l. ~50-55 (refus `target !== "local"`, refs CLI-013/CLI-023) | Commande `arc deploy` |
| `packages/arc-cli/src/commands/{status,logs,restart,backup,restore,project}.ts` | divers | importent `LocalAdapter` directement (pas dual) | Commandes ops — usage **trivial** de LocalAdapter |
| `packages/arc-cli/src/deploy/deploy.ts` | ~95 | tout (utilise `ExecutionAdapter` abstrait) | Orchestrateur deploy — adapter générique, **garde la généricité ou simplifie** ? |
| `packages/arc-cli/src/deploy/deploy.test.ts` | ~70 | tout (utilise `MockAdapter`) | Tests deploy via mock |
| `packages/arc-cli/src/ansible/run.ts` | ~70 | tout (utilise `ExecutionAdapter`) | Wrapper ansible-playbook — toujours utile en local |
| `packages/arc-cli/src/ansible/run.test.ts` | ~50 | tout | Tests ansible |
| `packages/arc-shared/src/schemas/config.ts` | 73 | l. 30 (`target: z.enum(["local","vps"])`), l. 33 (`provider: providerSchema.optional()`), l. 49-57 (`superRefine` target↔provider), JSDoc ADR-0009 | Schéma racine |
| `packages/arc-shared/src/schemas/provider.ts` | 19 | tout (Hetzner-only — utile uniquement pour provisioning externe) | Sous-schéma provider |
| `packages/arc-shared/src/schemas/dns.ts` | 22 | l. 7-8 + 18 (`tunnel: z.boolean()`), JSDoc cite ADR-0009 §6.1 | Sous-schéma DNS Cloudflare |
| `packages/arc-shared/src/schemas/config.test.ts` | ~120 | toutes les assertions sur `target=vps`, `provider`, `target=azure`, etc. | Tests schéma — à reformer profondément |
| `packages/arc-cli/src/templates/prod-compose.test.ts` | ~50 | helper `configFor("vps")` qui injecte `provider` | Test prod-compose — refactor mineur |
| `packages/arc-cli/src/init/serialize.test.ts` | ~70 | fixture VPS avec `provider` | Test serialize — refactor mineur |
| `packages/arc-cli/src/config/load.test.ts` | ~110 | fixtures `valid-vps.yml`, `invalid-schema.yml` (target azure) | Tests loader — refactor mineur |
| `packages/arc-cli/src/config/__fixtures__/valid-vps.yml` | ~40 | tout (config target=vps) | Fixture VPS — supprimer |
| `packages/arc-cli/src/config/__fixtures__/valid-local.yml` | 11 | l. `target: local` (à enlever) + `tunnel: true` | Fixture local — refactor (devient juste `arc.config.yml` minimal) |

**Bilan code source** : ~10 fichiers à supprimer entièrement, ~12 fichiers à refactorer.

### Documentation `docs/`

| Fichier | Mention | Action probable |
|---|---|---|
| `docs/03-architecture-decisions/0009-dual-target-local-vps.md` | ADR central de la double cible | **Statut : Superseded by ADR-0012** (laisser le contenu, marquer superseded) |
| `docs/03-architecture-decisions/0002-bun-runtime-cli.md` | Mentionne `node-ssh` dans la stack | Refactor mineur (retirer `node-ssh`, ajouter `execa` seul) |
| `docs/03-architecture-decisions/README.md` | Index ADR avec ADR-0009 | Ajouter ADR-0012, marquer 0009 superseded |
| `docs/00-overview.md` | "Mode dual local/VPS identique pour dev et prod" | Refactor — remplacer par "Single-machine install agnostic provider" |
| `docs/05-glossary.md` | termes `target`, `LocalAdapter`/`VPSAdapter`, `Cloudflare Tunnel`, `arc.config.yml`, `provisionHetzner` | Refactor (retirer dual, garder ce qui reste) |
| `docs/04-conventions/testing.md` | exemple `arc deploy` | Mineur |
| `docs/01-spec-infra.md` | spec entière fondée sur dual target | **À garder en l'état comme document historique** (mais signaler en tête que ADR-0012 supersede §6) |
| `docs/02-spec-arc-product.md` | référence spec-infra dual target | Idem |
| `CLAUDE.md` | l. 30+ (stack figée mentionne ADR-0009), section "ADR-0009 Dual target" | Refactor — référencer ADR-0012 |
| `README.md` | liste commandes `arc migrate --to <host>`, mentionne VPS | Refactor — retirer migrate, ajouter `arc setup`/install.sh |
| `docs/refactor-0012-inventory.md` | présent fichier | Pas de modif |

---

## A.2 — Classification 🟥/🟧/🟩

### 🟥 À SUPPRIMER (pure logique transport SSH / provisioning externe / dual target)

| Élément | Justification |
|---|---|
| `packages/arc-cli/src/exec/vps.ts` | VPSAdapter SSH — modèle dual mort |
| `packages/arc-cli/src/exec/vps.test.ts` | Tests VPSAdapter |
| `packages/arc-cli/src/exec/provision.ts` | `provisionHetzner` — provisioning externe mort |
| `packages/arc-cli/src/migrate/migrate.ts` | Migration local→VPS dual-adapter morte |
| `packages/arc-cli/src/migrate/migrate.test.ts` | Tests migrate |
| `packages/arc-cli/src/commands/migrate.ts` | `arc migrate` mort (single-machine = pas de migration via SSH) |
| `packages/arc-cli/src/tunnel/cloudflared.ts` | Cloudflare Tunnel = artefact du dual target — single-machine n'en a pas besoin (l'utilisateur ouvre 80/443 sur son VPS) |
| `packages/arc-cli/src/tunnel/cloudflared.test.ts` | Tests tunnel |
| `packages/arc-cli/src/config/__fixtures__/valid-vps.yml` | Fixture target=vps |
| `packages/arc-shared/src/schemas/provider.ts` | Sous-schéma Hetzner-only — provisioning externe mort |
| Champ `target` dans `arcConfigSchema` | Plus qu'un mode |
| Champ `provider` dans `arcConfigSchema` | Plus de provisioning externe |
| Champ `tunnel` dans `dnsSchema` | Plus de tunnel |
| `superRefine target↔provider` dans config.ts | Plus pertinent |
| Prompts `select target` + branche vps dans `init/prompts.ts` (l. 43-50, 88, 92-120) | Mode unique |
| Refus `target !== "local"` dans `commands/deploy.ts` | Plus pertinent |
| Imports `LocalAdapter`+`VPSAdapter` dans tous les commands | LocalAdapter devient l'adapter implicite ou disparaît |

**Estimation 🟥** : ~9 fichiers entièrement supprimés (~575 LoC), portions critiques de 6 fichiers (~80 LoC).

### 🟧 À REFACTOR (logique générique qui simplifie après suppression)

| Élément | Refactor attendu |
|---|---|
| `packages/arc-cli/src/exec/types.ts` | Garder l'interface `ExecutionAdapter` — devient juste un point d'extension future. JSDoc à recalibrer (pas de mention LocalAdapter/VPSAdapter). **Alternative radicale : supprimer entièrement et appeler directement `node:child_process` / `node:fs` partout** — à débattre Phase B. |
| `packages/arc-cli/src/exec/local.ts` | Renommer `LocalAdapter` → `HostAdapter` (ou supprimer la classe et exporter des fonctions libres). Laisser execa + fs. |
| `packages/arc-cli/src/exec/local.test.ts` | Adapter les imports/noms. |
| `packages/arc-cli/src/exec/mock.ts` | Garder pour les tests, mais devient `HostAdapter` côté nom si on renomme. |
| `packages/arc-cli/src/exec/mock.test.ts` | Idem. |
| `packages/arc-cli/src/exec/index.ts` | Retirer les exports VPS/provisioning. |
| `packages/arc-cli/src/init/prompts.ts` | Retirer les questions target/provider/tunnel. Ne reste que project, domain, email, dns_zone, dns_token. |
| `packages/arc-cli/src/init/serialize.test.ts` | Retirer fixture VPS. |
| `packages/arc-cli/src/config/load.test.ts` | Retirer `valid-vps.yml`. Le cas "schéma invalide" doit pivoter sur un autre champ (ex: project slug invalide). |
| `packages/arc-cli/src/config/__fixtures__/valid-local.yml` | Renommer en `valid.yml`, retirer `target: local` + `tunnel: true`. |
| `packages/arc-cli/src/config/__fixtures__/invalid-schema.yml` | Cas "target azure" disparaît — pivoter sur project slug invalide. |
| `packages/arc-shared/src/schemas/config.ts` | Retirer `target`, `provider`, `superRefine target↔provider`. Garder unique-subdomains. Mettre à jour JSDoc. |
| `packages/arc-shared/src/schemas/dns.ts` | Retirer `tunnel`. |
| `packages/arc-shared/src/schemas/config.test.ts` | Retirer cas target/vps. Pivot sur les nouveaux champs. |
| `packages/arc-shared/src/schemas/index.ts` | Retirer export `providerSchema`, `Provider`. |
| `packages/arc-cli/src/commands/{status,logs,restart,backup,restore,project,deploy}.ts` | Si on garde le pattern `new LocalAdapter()` : minimal ajustement de nom. Si on passe à des fonctions libres : refonte plus profonde. |
| `packages/arc-cli/src/deploy/deploy.ts` | Garder comme orchestrateur — supprimer la branche `target=vps`. |
| `packages/arc-cli/src/deploy/deploy.test.ts` | Tests inchangés via MockAdapter. |
| `packages/arc-cli/src/ansible/run.ts` | Garder — devient toujours local. JSDoc à actualiser. |
| `packages/arc-cli/package.json` | Retirer deps `node-ssh`. |
| `packages/arc-cli/src/cli.ts` | Retirer enregistrement `MigrateCommand`. |
| `packages/arc-cli/src/templates/prod-compose.test.ts` | Adapter helper sans `target=vps`. |

**Estimation 🟧** : ~16 fichiers à refactorer.

### 🟩 À CONSERVER (logique 100% indépendante du modèle)

- `packages/arc-cli/src/templates/__templates__/*.eta` — composes prod/sandbox/agents + env (aucun n'utilise `target`)
- `packages/arc-cli/src/templates/{prod,sandbox,agents,env}-compose.ts` — générateurs purs
- `packages/arc-cli/src/templates/render.ts`, `index.ts`
- `packages/arc-cli/src/templates/{sandbox,agents,env}-compose.test.ts` — tests purs
- `packages/arc-cli/src/templates/__templates__/env.eta` — `.env` partagé
- `packages/arc-cli/src/state/*` — state.json
- `packages/arc-cli/src/state/store.test.ts`
- `packages/arc-cli/src/backup/{run,restore,upload}.ts` + tests — opèrent sur l'adapter abstrait
- `packages/arc-cli/src/projects/{add,coolify}.ts` + tests — Coolify API client
- `packages/arc-cli/src/telemetry/store.ts` + test
- `packages/arc-cli/src/status/check.ts` + test
- `packages/arc-cli/src/logs/tail.ts` + test
- `packages/arc-cli/src/init/{serialize,write}.ts` + tests
- `packages/arc-cli/src/config/{load,errors}.ts` — parsing YAML + erreurs
- `packages/arc-cli/src/commands/{init,version,help,telemetry}.ts`
- `packages/arc-cli/src/banner.ts`
- `packages/arc-shared/src/schemas/{backups,services,project,stack}.ts`
- `packages/arc-cli/install.sh` — déjà aligné avec le modèle "single-machine"
- `packages/arc-cli/scripts/{copy-templates,build-binaries}.mjs`
- `packages/arc-cli/homebrew/arc.rb`
- `packages/arc-cli/ansible/playbook.yml` (placeholder)
- Tout `packages/arc-shared/` hors provider/dns/config

---

## A.3 — Dépendances à retirer

| Dep | Package.json | Usage actuel | Remplacement |
|---|---|---|---|
| `node-ssh` (^13.2.1) | `packages/arc-cli/package.json` deps | `vps.ts` uniquement | **À retirer** — plus de SSH côté CLI |
| `ssh2` (transitive de node-ssh) | n/a (sub-dep) | n/a | Retiré automatiquement avec node-ssh |
| `hcloud` | déjà retiré pendant CLI-011 | — | n/a |
| `hetzner-cloud-js` | jamais ajouté (utilisé `fetch` direct) | n/a | n/a |
| `execa` | `packages/arc-cli/package.json` deps | `LocalAdapter` | **À conserver** (devient l'adapter unique) |

**Action** : `pnpm --filter @euglowlabs/arc-cli remove node-ssh`.

---

## A.4 — Tests à modifier ou supprimer

### Supprimer entièrement (🟥)
- `packages/arc-cli/src/exec/vps.test.ts` (2 tests)
- `packages/arc-cli/src/migrate/migrate.test.ts` (1 test)
- `packages/arc-cli/src/tunnel/cloudflared.test.ts` (2 tests)

**Total tests supprimés** : 5

### Refactor (🟧)
- `packages/arc-cli/src/exec/local.test.ts` — adapter import si renommage
- `packages/arc-cli/src/exec/mock.test.ts` — idem
- `packages/arc-cli/src/init/serialize.test.ts` — retirer fixture VPS (1 test concerné)
- `packages/arc-cli/src/config/load.test.ts` — retirer `valid-vps.yml`, ajuster `invalid-schema.yml` (2 tests touchés)
- `packages/arc-shared/src/schemas/config.test.ts` — retirer cas target/vps/provider (3 tests à reformer)
- `packages/arc-cli/src/templates/prod-compose.test.ts` — helper `configFor` simplifié (1 test concerné)

**Total tests refactorés** : ~7

### Tests inchangés (🟩) — environ 60+ tests Vitest sur templates, backup, state, status, logs, telemetry, init/serialize/write, config/errors, deploy, ansible.

---

## A.5 — Tâches DÉJÀ FERMÉES contenant du code à supprimer/refactorer

| ID | Titre | Code à toucher |
|---|---|---|
| **CLI-011** | `VPSAdapter` via node-ssh + Hetzner SDK | Supprimé entièrement (vps.ts + provision.ts + vps.test.ts) |
| **CLI-023** | Commande `arc migrate --from=local --to=<vps-ip>` | Supprimé entièrement (migrate.ts + commands/migrate.ts + tests) |
| **CLI-024** | Cloudflare Tunnel auto en mode `target: local` | Supprimé entièrement (cloudflared.ts + test) |
| **CLI-009** | Adapter abstrait `ExecutionAdapter` interface | JSDoc/types à actualiser (pas de "LocalAdapter vs VPSAdapter") |
| **CLI-010** | `LocalAdapter` via execa | Conservé, possiblement renommé `HostAdapter` |
| **CLI-003** | Schéma zod `arc.config.yml` | Refactor : retirer `target`, `provider`, `tunnel` |
| **CLI-004** | Loader `arc.config.yml` | Tests refactorés (fixtures) |
| **CLI-005** | `arc init` interactif | Prompts simplifiés (pas de question target) |
| **CLI-012** | `arc deploy` orchestrant adapter | Refactor (pas de gating sur target=vps) |

Aucune tâche fermée n'est invalidée — toutes ont produit des artefacts encore utiles ou refactorables. Les notes d'archive resteront sur disque (pas de réécriture historique).

---

## A.6 — Tâches du backlog non commencées qui deviennent OBSOLÈTES

Aucune tâche ⬜ ne reste dans le backlog actuel après Phase 1 + Phase 0 closes. Les tâches CLI-029 à CLI-035 que j'avais **proposées** (Ansible roles, câblage `provisionHetzner` + `arc deploy --target=vps`, DNS auto, E2E test ephémère VPS) **n'ont jamais été ajoutées à `tasks/INDEX.md`**.

Donc : **0 tâche backlog à déplacer en `cancelled/`**.

Néanmoins, en Phase B on créera Phase 1.5 (REFACTOR-001 → 003 + INSTALL-001/ANSIBLE-001/DNS-001/E2E-001) qui remplace conceptuellement le plan CLI-029→035 jamais écrit.

---

## A.7 — Documentation à mettre à jour

| Fichier | Modif attendue |
|---|---|
| `docs/03-architecture-decisions/0009-dual-target-local-vps.md` | Statut → "Superseded by ADR-0012 — 2026-05-03". Lien explicite. Conserver le contenu historique. |
| `docs/03-architecture-decisions/0012-single-machine-install.md` | **Création** (Phase B). |
| `docs/03-architecture-decisions/README.md` | Index : ajouter ADR-0012, marquer 0009 ⛔ superseded |
| `docs/03-architecture-decisions/0002-bun-runtime-cli.md` | Retirer mention `node-ssh` de la stack |
| `docs/00-overview.md` | Reformuler "Mode dual local/VPS" → "Single-machine install agnostic provider". Schéma à actualiser. |
| `docs/05-glossary.md` | Retirer entrées `target`, `LocalAdapter`/`VPSAdapter`, `Cloudflare Tunnel`, `provisionHetzner`. Ajouter `arc setup`. |
| `docs/04-conventions/testing.md` | Mineur (commande exemple) |
| `CLAUDE.md` | Section "Stack figée" : retirer ADR-0009 row, ajouter ADR-0012. Section "Naming des composants" inchangée. |
| `README.md` | Retirer ligne `arc migrate`. Ajouter `arc setup`. Mettre à jour le quickstart "Phase 1". |
| `docs/01-spec-infra.md` | Bandeau en tête : "ADR-0012 supersede §5.6, §6, §13 — voir ADR-0012 pour le modèle d'install actuel". Spec elle-même conservée comme document historique. |
| `docs/02-spec-arc-product.md` | Bandeau en tête (idem). |

---

## A.8 — Estimation chiffrée

| Métrique | Valeur |
|---|---|
| Fichiers source supprimés entièrement | **9** (`vps.ts`, `vps.test.ts`, `provision.ts`, `migrate.ts`, `migrate.test.ts`, `commands/migrate.ts`, `cloudflared.ts`, `cloudflared.test.ts`, `valid-vps.yml`) |
| Fichier schéma supprimé | **1** (`schemas/provider.ts`) |
| Total fichiers supprimés | **10** |
| Fichiers refactorés (touche ≥ 1 ligne) | **~16** (config.ts, dns.ts, types.ts, local.ts/test, mock.ts/test, exec/index.ts, init/prompts.ts, serialize.test.ts, load.test.ts, valid-local.yml, invalid-schema.yml, config.test.ts, prod-compose.test.ts, deploy.ts, deploy.test.ts, exec import dans commands/*.ts) |
| LoC éliminées (estimation conservatrice) | **~700 lignes** (env. 575 directement supprimées + ~125 retirées dans les fichiers refactorés via les sections target/provider/tunnel/imports) |
| Tests Vitest supprimés | **5** |
| Tests Vitest refactorés | **~7** |
| Total tests Vitest avant | ~75 |
| Total tests Vitest après (estimation) | ~70 |
| Dépendances npm retirées | **1** (`node-ssh`, plus la sub-dep ssh2 transitive) |
| Tâches archivées impactées (notes uniquement) | **9** |
| Tâches backlog annulées | **0** (plan CLI-029→035 jamais écrit) |
| ADRs créés | **1** (ADR-0012) |
| ADRs marqués superseded | **1** (ADR-0009) |
| Fichiers docs à mettre à jour | **~10** |

---

## Pièges techniques signalés (à valider en Phase B)

### P1 — Multi-VPS dans le nouveau modèle

Le modèle "single-machine" résout 1 utilisateur, 1 VPS. Comment l'utilisateur **gère plusieurs VPS** (exemple : prod + staging) ?

Options à débattre Phase B :
- **(a)** Pas de multi-VPS au niveau du CLI — l'utilisateur SSH sur chaque machine et y lance `arc setup`. Cohérent avec Coolify.
- **(b)** Garder une notion d'inventaire dans `~/.arc/instances.json` côté machine de l'opérateur, mais `arc <cmd>` n'opère que sur l'instance courante.
- **(c)** Multi-VPS reporté à Phase 4 / ARC Cloud (spec produit §7) — l'orchestration multi-tenant arrive avec le SaaS.

→ **Recommandation : (a) + (c)**. CLI = single-machine pur. ARC Cloud = orchestrateur multi-VPS.

### P2 — `arc migrate` perdu

La commande `arc migrate` (CLI-023) servait à migrer local → VPS. Dans le nouveau modèle :
- **Local n'est plus une cible** (pas de `target`). L'utilisateur installe ARC sur sa **machine de test** ou directement sur son **VPS**.
- Le besoin "déplacer mes données d'une machine A vers une machine B" reste valable mais devient un **workflow utilisateur** : `arc backup` sur A, scp manuel, `arc restore` sur B. Pas de commande dédiée.

→ **Suppression assumée**. Documenter le workflow `backup + scp + restore` dans le README.

### P3 — `Cloudflare Tunnel` perdu

Le tunnel servait au mode local (HTTPS public sans port forward). Single-machine sur VPS = ports 80/443 ouverts → Let's Encrypt classique via Traefik. Plus besoin de tunnel.

Cas d'usage résiduel : utilisateur derrière NAT qui veut quand même exposer son ARC (cas Raspberry Pi à la maison). Le binaire `cloudflared` reste installable manuellement par l'utilisateur — ce n'est plus un objet du CLI.

→ **Suppression assumée**. Mention dans les FAQ futures.

### P4 — Renommage `LocalAdapter` → `HostAdapter` ou suppression de l'abstraction

Si on adopte le modèle single-machine, `LocalAdapter` est l'unique implémentation. Choix Phase B :
- **(a)** Garder l'abstraction `ExecutionAdapter` + renommer `LocalAdapter` → `HostAdapter`. Permet `MockAdapter` pour les tests, reste extensible.
- **(b)** Supprimer toute l'abstraction. Les commands appellent directement `execa` + `node:fs`. Tests utilisent vitest mocks.

→ **Recommandation : (a)**. La généricité a un coût marginal (un fichier `types.ts`) et garde `MockAdapter` qui est très utile pour les ~50 tests existants. Tout casser pour gagner ~80 LoC ne vaut pas la peine.

### P5 — Schéma `arc.config.yml` : forme finale

Après suppression de `target`, `provider`, `tunnel`, le schéma se réduit à :
```yaml
project: johann-stack
domain: mondomaine.dev
email: johann@mondomaine.dev
dns:
  provider: cloudflare
  zone: mondomaine.dev
  api_token: ${CLOUDFLARE_TOKEN}
stack: { paas: coolify, ai_stack: true, sandbox: true, monitoring: uptime-kuma }
backups: { enabled: true, schedule: "0 2 * * *", retention_days: 7 }
services: { ollama: { models: [...] } }
projects: [...]
```

C'est plus propre, mais soulève une question : **`arc setup` (la nouvelle commande all-in-one) écrit-il un `arc.config.yml` ou demande-t-il les questions interactivement à chaque commande ?** Cohérence avec Coolify : Coolify n'a pas de fichier de config — tout est en DB SQLite. Notre approche YAML déclaratif est meilleure pour le GitOps mais moins "single-machine".

→ **À débattre Phase B**. Recommandation a priori : **garder le YAML** (gitops + reproductibilité), `arc setup` le génère à `~/.arc/arc.config.yml` au premier lancement.

### P6 — Convention de commit `ci`

Lors de INFRA-010, on a découvert que `ci:` n'est pas dans la liste des types autorisés (`feat|fix|refactor|chore|docs|test|spike`). Pour ce refactor on utilisera `refactor:` (alignement avec ADR-0012). À noter pour plus tard : ajouter `ci` ou non ? Hors scope ici.

---

## Synthèse Phase A

- **L'inventaire est complet et chiffré.**
- **Pas de modif de code.** La branche backup `backup/before-adr-0012` est en place, locale et remote.
- **6 pièges techniques** sont signalés ci-dessus (P1 à P6) — à arbitrer en Phase B avant tout code.
- **Estimation totale** : 10 fichiers à supprimer, 16 à refactorer, ~700 LoC éliminées, 5 tests retirés, 7 tests refactorés, 1 dep retirée.
- **Cancellation** du backlog : 0 (CLI-029→035 jamais écrits).
- **ADRs** : 1 nouveau (0012), 1 superseded (0009).

⚠️ **STOP — Phase A terminée. J'attends `go phase B` explicite.**

Pendant cette attente, je peux répondre à des questions sur les choix proposés (P1 à P6 notamment), mais je **ne touche à aucun code**.
