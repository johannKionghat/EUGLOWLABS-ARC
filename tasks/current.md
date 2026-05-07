# Tâche : ANSIBLE-001c — Rôles `sandbox` + `backups` + setup.yml final

## Statut
🟢 Prête pour archive — sous-tâches 1 → 3 livrées le 2026-05-07.

### Recap des commits poussés sur `origin/main`

| Commit | Sous-tâche | Sujet |
|---|---|---|
| `adfabca` | 1 | rôle `sandbox` — 3 networks Docker isolés (prod_net + ai_net + sandbox_net `internal: true`), labels `arc.*`, loop sur `arc_networks` |
| `54b8bae` | 2 | rôle `backups` — apt rclone, `r2.env` operator-managed, parse loop-combine, `rclone obscure` × 2, 3 templates (rclone.conf + arc-backup.sh + cron), encryption mandatory via crypt remote, auto-discovery container Postgres ; `.gitignore` patché pour exempter le rôle |
| _(à venir)_ | 3 | finalize 001c validation (criteria check + scratchpad recap) |

### Bilan validation finale (sous-tâche 3)

- `ansible-lint setup.yml roles/` → **0 violation, 0 warning, profile `production`** sur 24 fichiers (escalade `min` → `production` maintenue depuis 001a).
- `ansible-playbook --syntax-check setup.yml` → exit 0.
- `ansible-playbook --check --connection=local -i 'localhost,' setup.yml` → échec attendu sur `Gathering Facts` (sudo TTY indispo dans le harness Claude Code). **Smoke runtime reporté à E2E-001 sur VPS jetable.**
- `pnpm test` → **144 / 144 verts** (cache hit Turbo, zéro régression côté TS).
- `pnpm lint` → Biome 107 fichiers, no fixes.
- `pnpm typecheck` → tous packages OK (vert depuis `a63ecd1`).

**Phase 1.5 Ansible complète** : 6 rôles (`hardening`, `docker`, `coolify`, `ai-stack`, `sandbox`, `backups`) couvrant ANSIBLE-001a + 001b + 001c. Reste DNS-001 + E2E-001 hors Ansible pour fermer le Chantier 1.

## Objectif
Finaliser le playbook ARC en livrant les **deux derniers rôles infra** posés sur les 4 livrés (hardening + docker + coolify + ai-stack) :
- `sandbox` — créer les **3 réseaux Docker isolés** (`prod_net`, `ai_net`, `sandbox_net`) selon ADR-0008. `sandbox_net` est `internal: true` (no internet, no cross-network). Les networks ARC pré-existent à toute orchestration future de containers maison (OpenClaw, DeepAgents, code executor) — leur déploiement est hors scope 001c.
- `backups` — installer rclone + script de backup quotidien (pg_dump du Postgres ai-stack + dossiers `/opt/coolify/data` + `~/.arc/credentials` + `~/.arc/state.json`) + cron daily 3am + rotation 30 jours + upload chiffré vers Cloudflare R2 via rclone crypt remote.

À la fin de 001c, `setup.yml` invoque `roles: [hardening, docker, coolify, ai-stack, sandbox, backups]` — Phase 1.5 Ansible **complète**. Reste DNS-001 + E2E-001 pour fermer le Chantier 1.

## Critères d'acceptation

### Arborescence
- [x] Arborescence créée pour `roles/sandbox/` et `roles/backups/` (tasks + handlers + defaults, plus `templates/` côté backups)

### Rôle `sandbox`
- [x] Liste `arc_networks` dans `defaults/main.yml` (3 entrées prod_net/ai_net/sandbox_net)
- [x] Subnets fixes 172.20.0.0/24 + 172.21.0.0/24 + 172.22.0.0/24, driver `bridge`
- [x] `sandbox_net` `internal: true` (anti-exfiltration) ; `prod_net` + `ai_net` external
- [x] Labels `arc.network` / `arc.role` / `arc.managed-by` posés sur chaque network
- [x] `community.docker.docker_network` avec `loop` sur `arc_networks` (DRY)
- [x] `loop_control.label` pour clarté output Ansible
- [ ] Idempotence runtime : second run = `changed=0` _(reporté à E2E-001)_
- [ ] Networks effectivement créés et isolés runtime _(reporté à E2E-001)_
- [ ] `sandbox_net` no-internet runtime (ping depuis container) _(reporté à E2E-001)_

### Rôle `backups`
- [x] `apt install rclone`
- [x] `stat r2.env` pivot avec gating
- [x] Skip défensif avec warning loud si `r2.env` absent
- [x] 7 vars defaults exposées + `arc_user` / `arc_credentials_dir` mirror
- [x] Loop-combine pour parser `r2.env` (idiomatique 2.10+, défensif sur edge cases)
- [x] `rclone obscure` × 2 mandatory pour le crypt remote (`no_log: true`)
- [x] Template `rclone.conf.j2` (2 remotes : `arc-r2` s3 + `arc-r2-crypt` wrapper)
- [x] Template `arc-backup.sh.j2` (6 sections, `set -euo pipefail`, logs avec timestamp)
- [x] Auto-discovery container Postgres via Docker compose labels (pas hardcoded `supabase-db`)
- [x] Template `arc-backup.cron.j2` (cron classique `/etc/cron.d/arc-backup`)
- [x] Permissions correctes (0700 dir, 0600 conf, 0750 script, 0644 cron)
- [x] Encryption MANDATORY via `arc-r2-crypt` remote (pas de plaintext sur R2)
- [x] Block conditional pour cleanliness (vs `when:` répété)
- [x] `no_log: true` sur 4 tasks sensibles (parse, 2× obscure, template rclone.conf)
- [ ] Idempotence runtime : second run = `changed=0` _(reporté à E2E-001)_
- [ ] Backup réellement effectué et chiffré sur R2 _(reporté à E2E-001)_
- [ ] Cron déclenché et logs propres _(reporté à E2E-001)_
- [ ] Restore depuis R2 fonctionnel (test critique) _(reporté à E2E-001)_

### `playbooks/setup.yml`
- [x] Header status complet (001a + 001b + 001c livrés, Phase 1.5 Ansible quasi-complète)
- [x] `roles: [hardening, docker, coolify, ai-stack, sandbox, backups]` dans le bon ordre
- [x] Tous les rôles déclarés Phase 1.5 sont en place

### Tests
- [x] `ansible-playbook --syntax-check setup.yml` passes (exit 0)
- [x] `ansible-lint setup.yml roles/` → 0 violation, profile `production` (24 fichiers)
- [x] `pnpm test` → 144 verts (zéro régression)
- [x] `pnpm lint` + `pnpm typecheck` verts (Biome 107 fichiers, tous tsc OK)
- [ ] **Smoke test humain global** (6 rôles enchaînés sur VM jetable) _(reporté à E2E-001 — design)_

## Fichiers concernés (estimation : 9 fichiers, dont 8 nouveaux)

| Fichier | Action |
|---|---|
| `packages/arc-cli/playbooks/roles/sandbox/tasks/main.yml` | création |
| `packages/arc-cli/playbooks/roles/sandbox/handlers/main.yml` | création (placeholder) |
| `packages/arc-cli/playbooks/roles/sandbox/defaults/main.yml` | création (`arc_networks` list) |
| `packages/arc-cli/playbooks/roles/backups/tasks/main.yml` | création |
| `packages/arc-cli/playbooks/roles/backups/handlers/main.yml` | création (placeholder) |
| `packages/arc-cli/playbooks/roles/backups/defaults/main.yml` | création (schedule, retention, sources, R2 vars) |
| `packages/arc-cli/playbooks/roles/backups/templates/arc-backup.sh.j2` | création (NEW) |
| `packages/arc-cli/playbooks/roles/backups/templates/rclone.conf.j2` | création (NEW) |
| `packages/arc-cli/playbooks/setup.yml` | modif (append 2 rôles + header final) |

⚠️ **9 fichiers** = au-dessus de la limite haute CLAUDE.md (« > 5 → STOP, demander confirmation »). Justifié par la nature pure-rôle de la tâche (chaque rôle Ansible = au minimum tasks + handlers + defaults). Si le rôle backups déborde (template script qui se fragmente), STOP et redécoupe en ANSIBLE-001c-bis.

## ADRs liés

- **ADR-0008** — Trois réseaux Docker isolés : `prod_net`, `ai_net`, `sandbox_net`. Le rôle `sandbox` est leur point de création. ⚠️ note de naming : le rôle s'appelle `sandbox` mais crée les 3 networks (le nom reflète la finalité critique d'isolation, pas seulement le sandbox_net).
- **ADR-0011** — Critère A4 (`arc setup` idempotent). Critères backups (3-2-1, rclone R2, cron quotidien) implicites.
- **ADR-0012** — Single-machine.
- **ADR-0015** — Layout `~/.arc/`. `rclone.conf` sous `~/.arc/credentials/` (user-scoped, 0600). Script `arc-backup.sh` sous `/usr/local/bin/` (root). Cron sous `/etc/cron.d/`.

## Conventions à respecter

- `coding-style.md` — YAML 2 espaces, FQCN partout (`ansible.builtin.*`, `community.docker.*`).
- `testing.md` — ansible-lint maintient profile `production`. Vitest 144 verts non négociable.
- ADR-0015 — secrets sous `~/.arc/credentials/`, code/scripts sous `/opt/` ou `/usr/local/bin/`.
- Pattern repris d'001a/001b : tags par rôle/sujet (ex: `[sandbox, network]`, `[backups, install]`, `[backups, schedule]`).

## Hors scope (NE PAS faire)

- Déployer les containers OpenClaw / DeepAgents / sandbox executor (= scope ARC-AGENT futur, pas 001c).
- Bridger Coolify network ou local-ai-packaged networks vers les 3 networks ARC (= scope futur, peut nécessiter compose overrides côté coolify/ai-stack).
- Backup du Postgres Coolify (cadrage B2 = ai-stack postgres uniquement → CLI gap pour Coolify).
- Configurer rotation côté R2 (la rotation 30j est locale/script-side, pas une lifecycle policy R2 — peut être ajoutée plus tard côté Cloudflare console).
- Test de restauration automatique mensuel (= job E2E-001 nightly future).
- Refactor de `arc_user` au play level (CLI gap noté en 001b).
- Configurer DNS Cloudflare records (= DNS-001).
- Lancer `arc setup --apply` réel sur la WSL.

## Décisions actées avant code (cadrage 2026-05-07)

### Sous-tâche 1 — Rôle `sandbox` (S1-S6)

- **S1** Module : `community.docker.docker_network` (déjà pinned dans `requirements.yml`).
- **S2** Driver : `bridge`.
- **S3** Subnets fixes : `prod_net 172.20.0.0/24`, `ai_net 172.21.0.0/24`, `sandbox_net 172.22.0.0/24`.
- **S4** `sandbox_net` `internal: true` (no internet, no cross-network) ; `prod_net` + `ai_net` external (default).
- **S5** Labels : `arc.network=<name>`, `arc.role=<prod|ai|sandbox>`, `arc.managed-by=arc-ansible-001c` sur chaque network.
- **S6** Liste `arc_networks` dans `defaults/main.yml`, `ansible.builtin.loop` sur la liste (DRY).

### Sous-tâche 2 — Rôle `backups` (B1-B7)

- **B1** Outil : `rclone`.
- **B2** Cibles : `/opt/coolify/data`, `~/.arc/credentials`, `~/.arc/state.json`, Postgres ai-stack (`docker exec localai-db pg_dump`).
- **B3** Postgres via `pg_dump` (atomique snapshot), dossiers via rclone copy direct.
- **B4** Schedule : daily 3am (`0 3 * * *`), variable `arc_backup_schedule` exposée.
- **B5** Retention : 30 derniers jours FIFO, variable `arc_backup_retention_days`.
- **B6** Encryption : rclone crypt remote **mandatory** (toutes les sources passent par crypt).
- **B7** R2 keys absentes : warning + skip (rôle ne plante pas, cron non installé).

### Question Q-RCLONE (à valider en sous-tâche 2)

- **Q-RCLONE** Méthode d'install : **A** (`apt install rclone`) — recommandation user, à valider à l'écriture du diff. Cohérent avec le pattern hardening/docker apt. Ubuntu 24.04 livre rclone 1.66+ (crypt remote + R2 backend stables depuis 2022). CLI gap si feature récente requise plus tard.

### Sous-tâche 3 — Validation finale (V1-V3)

- **V1** Critères proposés ci-dessus, validés ensemble lors de la sous-tâche 3.
- **V2** Smoke runtime reporté E2E-001 par design.
- **V3** Commit final si fix lint, sinon juste push scratchpad.

## Plan d'implémentation

### Sous-tâche 1 : Rôle `sandbox` (3 réseaux Docker isolés)
- Fichiers : `playbooks/roles/sandbox/{tasks,handlers,defaults}/main.yml` (création) + `playbooks/setup.yml` (append `sandbox` dans `roles:`)
- Effort estimé : ~30 min
- Détail : `defaults` expose `arc_networks` (list de 3 dicts : `name`, `subnet`, `internal`, `labels`). `tasks` : `community.docker.docker_network` avec `loop: "{{ arc_networks }}"`, paramètres `name`, `driver: bridge`, `ipam_config[0].subnet: "{{ item.subnet }}"`, `internal: "{{ item.internal | default(false) }}"`, `labels: "{{ item.labels }}"`. Handler placeholder. Tags `[sandbox, network]`.

### Sous-tâche 2 : Rôle `backups` ✅
- Fichiers : `playbooks/roles/backups/{tasks,handlers,defaults}/main.yml` + 3 templates (`rclone.conf.j2`, `arc-backup.sh.j2`, `arc-backup.cron.j2`) + `playbooks/setup.yml` (append `backups`)
- Détail livré : 9 vars defaults (7 backup-spécifiques + `arc_user`/`arc_credentials_dir` mirror). Tasks : apt install rclone universel, stat `r2.env` pivot, debug warning si absent (skip non-bloquant), block conditionnel avec 9 sub-tasks (slurp + parse loop-combine + 2× `rclone obscure` + dir + 3 templates + final debug). Encryption rclone crypt MANDATORY (passwords obscurcis). Auto-discovery container Postgres via Docker labels (pas hardcoded `supabase-db` — Compose v2 produit `localai-db-1`). Script 6 sections : Coolify data → ARC credentials → state.json → ai-stack Postgres → local cleanup → remote retention. Cron `/etc/cron.d/arc-backup` daily 3am. Tags `[backups, install/config/schedule]`. `no_log: true` sur 4 tasks sensibles.

### Sous-tâche 3 : setup.yml final + validation
- Fichiers : `playbooks/setup.yml` (header final mis à jour) + `tasks/current.md` (scratchpad enrichi avec résultats validation)
- Effort estimé : ~20 min
- Détail :
  - Final header : « Phase 1.5 Ansible complète — `roles: [hardening, docker, coolify, ai-stack, sandbox, backups]`. Reste DNS-001 + E2E-001 hors Ansible. »
  - Run `ansible-playbook --syntax-check setup.yml` → exit 0.
  - Run `ansible-lint setup.yml roles/` → 0 violation, profile `production` (escalade `min` → `production` maintenue depuis 001a).
  - Run `pnpm test` → 144 verts.
  - Run `pnpm lint` et `pnpm typecheck` → verts.
  - Pré-archive : statut → 🟢, recap commits, bilan validation finale (template repris d'001a/001b).

## Notes pour DNS-001 et E2E-001

- 001c laisse `setup.yml` avec `roles: [hardening, docker, coolify, ai-stack, sandbox, backups]` — Phase 1.5 Ansible **complète**.
- DNS-001 : Cloudflare API records (A wildcard pointant sur l'IP publique). Pas d'ansible — scope CLI ou shell-out.
- E2E-001 : test bout-en-bout sur VM jetable. C'est le moment où **toutes** les cases reportées (idempotence, healthchecks runtime, smoke humain, backup runtime) sont validées empiriquement.
- Backup smoke en E2E-001 : nécessite un compte R2 de test + un dataset Postgres minimal pour le round-trip.

## Scratchpad
- _(empty — Claude met à jour pendant le travail)_

## CLI gaps
- **Container Postgres ai-stack auto-discovery** : le script de backup utilise `docker ps --filter label=com.docker.compose.project=localai --filter label=com.docker.compose.service=db` pour trouver le container. Si upstream `local-ai-packaged` change le naming convention ou les labels Docker, le script silently passe en « warning + skip postgres ». Surveiller à chaque bump du SHA pinned.
- **Pattern dual-network pour agents** : quand OpenClaw/DeepAgents seront déployés en containers, documenter le pattern dual-network (container attaché à `sandbox_net` + `ai_net`) pour les agents qui appellent Ollama mais doivent rester anti-exfiltration. Dans le compose : `networks: [sandbox_net, ai_net]`. Hors scope 001c.
- Backup du Postgres Coolify non couvert en 001c (cadrage B2 = ai-stack postgres uniquement). À ajouter en 001c-bis ou nouvelle tâche dédiée si Coolify accumule des données critiques.
- Bridge entre Coolify network / local-ai-packaged networks et les 3 networks ARC (`prod_net`, `ai_net`, `sandbox_net`) non fait en 001c. Les services Coolify et AI tournent dans leurs propres networks internes pour l'instant. Bridge nécessitera des compose overrides côté coolify/ai-stack rôles ou un hook sandbox.
- Test de restauration automatique mensuel (cf. spec §12.4) à scheduler en E2E-001 nightly ou tâche dédiée.
- Lifecycle policy côté R2 (rotation managed by Cloudflare) non configurée — la rotation 30j est locale/script-side. À ajouter via Cloudflare API ou console.
- Hérités d'001a/001b à traiter au moment opportun :
  - Bump `community.docker >=3.7,<4.0` → swap `command: docker compose pull` pour `community.docker.docker_compose_v2_pull` (coolify rôle).
  - Régénération JWT trio Supabase avant exposition publique.
  - Pinning sparse-clone Supabase upstream.
  - SearXNG `cap_drop` dance drift watch.
  - Container name Ollama profile-dependent.
  - Suppression manuelle `local-ai.env` → desync Postgres.
  - Refacto `arc_user` au play level.
