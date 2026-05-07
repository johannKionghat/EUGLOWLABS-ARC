# Tâche : E2E-001 — Test bout-en-bout sur VM jetable

## Statut
🟡 En cours — démarrée le 2026-05-07

## Objectif
Livrer la **procédure** et les **outils** qui permettront de valider empiriquement Phase 1.5 sur une VM/VPS jetable. La tâche **ne livre pas le smoke réel** (qui sera fait par toi/un user lambda quand il aura les pré-requis : compte Cloudflare token, VPS Ubuntu 24.04, compte R2 avec keys). Une fois cette tâche livrée, **les ~30 critères runtime reportés** depuis ANSIBLE-001a/b/c + DNS-001 seront empiriquement validables en ~30 min via `bash scripts/smoke-test.sh` + checklist manuelle dans `docs/E2E-test-procedure.md`.

## Critères d'acceptation

### `scripts/smoke-test.sh` (sous-tâche 1)
- [ ] Pure Bash, exécutable (`chmod +x`), shebang `#!/usr/bin/env bash` + `set -euo pipefail`
- [ ] Pas de dépendance externe obligatoire (`jq` optionnel — fallback `grep`/`awk` si absent)
- [ ] **8 checks couverts** :
  - [ ] UFW : active, default deny incoming, allow `{{ arc_ssh_port }}` + 80 + 443
  - [ ] fail2ban : service `active`, jail `sshd` enabled
  - [ ] Docker engine : `systemctl is-active docker` + `docker version` exit 0
  - [ ] 3 networks ARC présents (`prod_net`, `ai_net`, `sandbox_net`)
  - [ ] `sandbox_net` `internal: true` (config check via `docker network inspect`)
  - [ ] Coolify : `curl localhost:8000` retourne `[200, 302, 401]`
  - [ ] Supabase Kong : `curl localhost:8001` retourne `[200, 302, 401]`
  - [ ] Ollama : `curl localhost:11434/api/version` retourne `200`
  - [ ] Backups : `/usr/local/bin/arc-backup.sh` présent (mode 0750) + `/etc/cron.d/arc-backup` présent
- [ ] Format rapport : sections par groupe + summary final (X passed / Y failed) + exit code (0 si tout vert, 1 si ≥1 failed)
- [ ] Couleurs ANSI activées par défaut (vert ✓, rouge ✗, jaune ⚠), `--no-color` flag pour désactivation (CI-friendly)
- [ ] Helper `--help` qui résume les checks effectués

### `docs/E2E-test-procedure.md` (sous-tâche 2)
- [ ] Section **Prérequis** : VPS Ubuntu 24.04, compte Cloudflare avec API token (`Zone:DNS:Edit`), compte R2 avec bucket + access keys
- [ ] Section **Install** : `arc setup --apply` walkthrough (commande + temps attendu ~10-15 min)
- [ ] Section **Smoke automatisé** : `bash scripts/smoke-test.sh` → résultat attendu 0 failed
- [ ] Section **Idempotence manuelle** : ré-exécuter `arc setup --apply`, vérifier `changed=0` dans Ansible recap
- [ ] Section **Sandbox runtime check** : `docker run --rm --network sandbox_net alpine ping -c1 -W2 8.8.8.8` doit FAIL (no internet)
- [ ] Section **Backups runtime** : `sudo /usr/local/bin/arc-backup.sh` → `rclone ls arc-r2-crypt:` montre les 4 sources (coolify-data, credentials, state, postgres) — round-trip
- [ ] Section **Restore runtime** : restore d'un backup R2 vers `/tmp/restore-test/` + verify checksum
- [ ] Section **DNS records** : `arc dns add` (vrai token) → `arc dns list` (verify) → `arc dns remove` → `arc dns list` (verify absent)
- [ ] Section **Collision detection runtime** : 2e `arc dns add` même name+type → erreur multi-line + `--force` replace
- [ ] Section **Cleanup** : commandes pour démonter le VPS test (Hetzner/OVH dashboard ou `terraform destroy`)
- [ ] Format checklist `[ ]` pour traçabilité des résultats par opérateur
- [ ] Lien depuis `packages/arc-cli/README.md` (section optionnelle « E2E testing »)

### Validation finale (sous-tâche 3)
- [ ] `pnpm test` → 164 verts maintenus (aucun TS modifié)
- [ ] `pnpm lint` → Biome no fixes
- [ ] `pnpm typecheck` → tous packages OK
- [ ] `ansible-lint` → 0 violation maintenu (no impact, scope outils/docs)
- [ ] `bash -n scripts/smoke-test.sh` → exit 0 (syntax check Bash)
- [ ] `shellcheck scripts/smoke-test.sh` si dispo, sinon noté en CLI gap
- [ ] `docs/E2E-test-procedure.md` relu et validé par toi avant clôture

## Fichiers concernés (estimation : 3 fichiers, dont 2 nouveaux)

| Fichier | Action |
|---|---|
| `scripts/smoke-test.sh` | création (NEW, ~200 lignes Bash) |
| `docs/E2E-test-procedure.md` | création (NEW, ~150 lignes Markdown) |
| `packages/arc-cli/README.md` | modif optionnelle (lien vers procédure) |

⚠️ **3 fichiers** — sous la limite CLAUDE.md (5). Pas de drapeau.

## ADRs liés

- **ADR-0008** — 3 réseaux Docker isolés. Le smoke-test vérifie leur présence + `internal: true` sur sandbox_net (config + runtime).
- **ADR-0011** — Critères d'acceptation A4 (idempotence) + B-* (services qui répondent runtime). E2E-001 fournit les outils pour valider chacun.
- **ADR-0012** — Single-machine. Le smoke-test tourne sur la VM cible elle-même (`localhost:*`).
- **ADR-0015** — Layout `~/.arc/`. Le smoke-test peut référencer mais ne touche pas (lecture seule).

## Conventions à respecter

- **Bash strict** : `set -euo pipefail`, shebang `#!/usr/bin/env bash`, mode 0755.
- **Sortie utilisateur** : sections ASCII (header, body, footer), couleurs ANSI conditionnelles via `$NO_COLOR` env ou `--no-color` flag.
- **Documentation** : `docs/` markdown, ton imperatif (« Run X », « Verify Y »), commandes copiables dans des blocs ` ```bash `.
- **Pas de code TS** dans cette tâche (scope outils/procédure).

## Hors scope (NE PAS faire)

- **Lancer le smoke réel sur un VPS** : E2E-001 livre les outils, pas l'exécution. L'opérateur (toi ou user lambda) lance après livraison.
- **Tests Phase 2+** (load testing, multi-host, audit sécurité externe) : CLI gap.
- **Auto-déploiement du VPS test** (Terraform / Pulumi) : pas pour MVP, opérateur provisionne manuellement.
- **CI nightly** mentionné dans INDEX (« CI nightly ~0,02 €/run ») : c'est un futur GitHub Actions workflow, hors scope MVP. CLI gap.
- **Refactor de `arc setup`** ou des rôles Ansible suite aux découvertes du smoke : ce sera des fix tasks dédiés (pattern `INSTALL-002` fix `a63ecd1`).
- **Modifications de `docs/migration-guide.md`** ou `docs/install-without-public-ip.md` : INDEX dit « toute commande qui échoue doit déclencher un patch DOC-001 ». E2E-001 livre la procédure ; les patches DOC-001 viennent post-smoke réel si besoin.

## Décisions actées avant code (cadrage 2026-05-07)

### E1-E8 (validés utilisateur)

- **E1** — `smoke-test.sh` : pure Bash, pas de dépendance externe (`jq` facultatif si présent, fallback grep/awk).
- **E2** — sandbox_net check : **config** (`docker network inspect sandbox_net | grep '"Internal": true'`) + **runtime** (`docker run --rm --network sandbox_net alpine ping -c1 -W2 8.8.8.8` doit FAIL). Le runtime check est dans `docs/` (manuel), config dans `smoke-test.sh` (auto).
- **E3** — Idempotence Ansible : section manuelle dans `docs/`, **pas dans smoke-test.sh** (nécessite re-run du playbook complet, lent).
- **E4** — Tests R2 / DNS / restore : section manuelle dans `docs/`, **pas dans smoke-test.sh** (dépendent de credentials externes).
- **E5** — Format rapport : sections par groupe (Hardening, Docker & Networks, Apps, Backups) + summary final `X passed / Y failed / Z warned` + exit code (0 ou 1).
- **E6** — Couleurs ANSI activées par défaut (vert ✓ / rouge ✗ / jaune ⚠), `--no-color` flag + détection `$NO_COLOR` env (cf. https://no-color.org/).
- **E7** — Fichiers versionnés dans le repo : `scripts/smoke-test.sh` + `docs/E2E-test-procedure.md`.
- **E8** — Tests Phase 2+ (load, multi-host, audit) → CLI gap, hors MVP.

## Plan d'implémentation

### Sous-tâche 1 : `scripts/smoke-test.sh` ✅
- Fichiers livrés : `scripts/smoke-test.sh` (NEW, mode 0755, ~220 lignes Bash)
- Détail livré :
  - **9 sections / ~40 checks** : Bootstrap (info) + UFW (8 checks dont negative port 8000) + fail2ban (3) + SSH (5) + Docker (4) + Networks ADR-0008 (8 dont runtime sandbox isolation via `! ping`) + HTTP Coolify/Supabase/Ollama (3) + Backups (6, dont `r2.env` warn-only) + CLI offline (3 incl. `arc dns *` `--dry-run`).
  - **4 helpers** : `check_cmd` / `check_output` (pipe + grep -E) / `check_file` (existence + mode) / `check_http` (curl + status codes).
  - **Defensive Bash** : `set -euo pipefail` + `IFS=$'\n\t'` + `PASSED=$((PASSED + 1))` (évite le bug `((var++))` qui retourne 1 quand 0→1 sous `set -e`).
  - **Couleurs ANSI** : NO_COLOR.org spec + `--no-color` flag + `[[ ! -t 1 ]]` détection auto.
  - **`arc_user` detection** : `SUDO_USER` → `USER` (skip root) + `getent passwd | cut -d: -f6` pour le home dir réel (pas `/home/` hardcodé).
  - **Exit codes** : 0 (all passed) / 1 (≥1 failed) / 2 (execution error : not root, unknown flag, no arc_user).
  - **Trap on EXIT** pour summary toujours imprimé même sur exit early.
- Validation : `bash -n` exit 0, `--help` exit 0, `pnpm test` 164 verts maintenus, `pnpm lint` clean, `pnpm typecheck` OK, `ansible-lint` 0 violation maintenu, `shellcheck` non installé localement → CLI gap noté.

### Sous-tâche 2 : `docs/E2E-test-procedure.md` ✅
- Fichiers livrés : `docs/E2E-test-procedure.md` (NEW, ~330 lignes Markdown) + `packages/arc-cli/README.md` (modif — section Testing avec lien)
- Détail livré :
  - **9 sections + Annexe A** : Prérequis (5 min) → Credentials (10 min, Cloudflare DNS + R2 + Ansible inv) → Install (mandatory, 30 min : `arc setup --apply` + PLAY RECAP + smoke-test + lecture rapport) → Idempotence (mandatory, 10 min, `changed=0` avec exception ai-stack tolérée) → DNS runtime (optionnel, 15 min, round-trip add/list/dig/remove + collision) → Backups runtime (optionnel, 15 min, trigger + rclone ls + restore Postgres jetable) → Critères d'acceptation (~30 cochables organisés par catégorie) → Cleanup (5 min) → Troubleshooting (3 sous-sections : erreurs Ansible, healthchecks HTTP, backup silent fail).
  - **Annexe A — cheatsheet** : 8 sections de commandes (UFW, fail2ban, SSH, Docker, Compose Coolify+ai-stack, Backups rclone, CLI ARC DNS, Logs système).
  - Format : pure ASCII, blocs `bash` copiables, format checklist `[ ]` pour traçabilité, estimations de temps par section, marqueurs `(mandatory)` / `(optionnel)` dans la TOC.
  - Cible utilisateur intermédiaire (liens externes pour SSH/sudo/docker basics).
  - Path Coolify confirmé `/opt/coolify/docker-compose.yml` cohérent avec rôle Ansible. CLI gap noté dans Annexe A (« à reconfirmer au runtime E2E réel »).
  - Cohérence cross-vérifiée : ports (8000/8001/11434), paths (`/usr/local/bin/arc-backup.sh`, `/etc/cron.d/arc-backup`, etc.), variables (`ARC_SSH_PORT`) toutes alignées avec `scripts/smoke-test.sh`.
  - 0 placeholder restant (`<TODO>`, `<your-domain>` etc.).
- Validation : `pnpm test` 164 verts maintenus, lint clean, typecheck OK, `ansible-lint` 0 violation.

### Sous-tâche 3 : Validation finale + clôture
- Fichiers : `tasks/current.md` (scratchpad)
- Effort estimé : ~20 min
- Détail :
  - Run `pnpm test` → 164 maintenus.
  - Run `pnpm lint` + `pnpm typecheck` → verts.
  - Run `ansible-lint setup.yml roles/` → 0 violation maintenu.
  - Run `bash -n scripts/smoke-test.sh` → syntax OK.
  - Si `shellcheck` dispo : `shellcheck scripts/smoke-test.sh` → 0 warning. Sinon CLI gap noté.
  - Pré-archive : statut → 🟢, recap commits, bilan préparé pour `/arc-task-complete`.

## Notes pour smoke réel (post-livraison E2E-001)

- E2E-001 livre les outils. Le smoke réel sera fait par l'opérateur sur VPS Ubuntu 24.04 jetable + compte Cloudflare + compte R2.
- Coût estimé : ~5 € VPS prorated (ou ~0.02 € si VPS Hetzner détruit après 1h) + ~0 € R2 (free tier suffisant pour quelques MB de test backup).
- Durée estimée : 30-45 min smoke complet (incluant `arc setup --apply` ~10 min + smoke-test.sh ~2 min + checklist manuelle ~20 min).
- Si une commande échoue : ouvrir une fix task dédiée avec ID approprié (ex: `INSTALL-002` pour TS, `ANSIBLE-001a-fix-X` pour rôle Ansible, `DOC-001` pour doc qui ment).

## Scratchpad
- _(empty — Claude met à jour pendant le travail)_

## CLI gaps
- **Path Coolify compose à reconfirmer** : `docs/E2E-test-procedure.md` Annexe A et la procédure utilisent `/opt/coolify/docker-compose.yml` (cohérent rôle Ansible coolify, var `arc_coolify_install_dir`). Selon la version Coolify, certains setups stockent dans `/opt/coolify/source/docker-compose.yml`. À vérifier au premier smoke réel sur VPS — fix le doc + Annexe A si différent.
- **UFW pattern matching** dans `smoke-test.sh` pourrait être plus tight (`^${PORT}/tcp\s+ALLOW`) — actuellement permissif (substring `${PORT}/tcp`). Cosmétique, faux positifs improbables.
- **`arc setup --status` CLI native** futur : remplacer `bash scripts/smoke-test.sh` par `arc smoke` (commande TS) pour distribution cleaner. Hors MVP.
- **`arc-smoke` command intégrée à la distribution** : transformer le bash script en commande clipanion (avec mêmes 9 sections + helpers). Évite le besoin d'avoir le repo cloné sur le VPS cible.
- **Tests Phase 2+** (load testing, multi-host, audit sécurité externe) : créer `scripts/smoke-test-extended.sh` distinct quand on en aura besoin. Pattern « base smoke + extended » est plus maintenable qu'un seul script qui grossit.
- **`shellcheck` non installé localement** : à ajouter en pre-commit hook ou CI workflow GitHub Actions pour catch les bugs Bash avant push. Hors MVP, à ajouter avec le hook `pnpm typecheck` mentionné dans CLI gaps INSTALL-002.
- **CI nightly E2E** (INDEX dit « ~0,02 €/run ») : workflow GitHub Actions qui spin un VPS jetable, lance `arc setup --apply` + `smoke-test.sh`, détruit. Hors scope MVP. À acter en future tâche dédiée si l'auteur veut un canary continu.
- **Tests Phase 2+** : load testing (combien de projets simultanés tient le VPS ?), multi-host (cluster ARC ?), audit sécurité externe (penetration test). Hors scope Phase 1.5.
- **Auto-provisioning VPS test** (Terraform / Pulumi) : automatise le « pré-requis VPS Ubuntu 24.04 ». Hors MVP — opérateur provisionne manuellement via dashboard fournisseur.
- **`shellcheck`** sur `smoke-test.sh` : si non disponible en local (`apt install shellcheck`), reporté à CI ou pre-commit hook futur.
- **Hérités d'001a/b/c + DNS-001** (10+ entrées) à traiter au moment opportun — cf. `tasks/completed/2026-05-07-DNS-001.md`.
