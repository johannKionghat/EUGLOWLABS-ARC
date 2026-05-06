# Tâche : ANSIBLE-001a — Skeleton `playbooks/roles/` + rôles `hardening` + `docker`

## Statut
🟢 Prête pour archive — sous-tâches 1 → 5 livrées le 2026-05-06 (tâche démarrée le 2026-05-05, découpée d'ANSIBLE-001 ce même jour, règle CLAUDE.md « 1 PR < 2h »).

### Recap des commits poussés sur `origin/main`

| Commit | Sous-tâche | Sujet |
|---|---|---|
| `b62ed47` | 1 | scaffold `roles/` tree + wire `setup.yml` to hardening + docker |
| `7a2e0c3` | 2 | UFW rules — install → IPv6 → defaults → allow {{ `arc_ssh_port` }}/80/443 → enable (allow-before-enable strict) |
| `7390a56` | 3 | fail2ban + SSH key-only + unattended-upgrades, safety check `authorized_keys`, `sshd -t` validate-before-flush |
| `dc0cd93` | 4 | docker role — modern keyring, dynamic arch mapping, `append: true` group, post-install Compose v2 assert |
| _(à venir)_ | 5 | finalize ansible-lint cleanup (16 fixes mécaniques + 1 noqa intentionnel) + scratchpad recap |

### Bilan validation finale (sous-tâche 5)

- `ansible-lint setup.yml roles/` → **0 violation, profile `production`** (escalade depuis `min`).
- `ansible-playbook --syntax-check setup.yml` → exit 0.
- `ansible-playbook --check --connection=local -i 'localhost,' setup.yml` → échec attendu sur `Gathering Facts` (sudo TTY indispo dans le harness Claude Code). **Smoke runtime reporté à E2E-001 sur VPS jetable.**
- `pnpm test` → **144 / 144 verts** (zéro régression côté TS, ce périmètre n'a pas touché de code TypeScript).

### Critères restants à humaniser avant `/arc-task-complete`

- Cocher manuellement chaque case `[ ]` de la section « Critères d'acceptation » qui est désormais satisfaite (tous les points UFW / fail2ban / SSH / unattended-upgrades / docker / setup.yml sont OK ; le **smoke humain** reste à faire par l'utilisateur sur VM jetable Ubuntu 24.04 — c'est `arc setup --apply` + check `ufw status numbered`, `fail2ban-client status sshd`, `docker version`, `groups $USER`, idempotence sur 2e run). Cette case sera signée par l'utilisateur, pas par moi.

## Objectif
Poser la fondation Ansible d'ARC (structure `roles/`, conventions, invocation depuis `setup.yml`) et livrer les **deux premiers rôles système** :
- `hardening` — UFW limité (22 + 80 + 443), fail2ban (jail `sshd`), SSH key-only, `unattended-upgrades`.
- `docker` — Docker Engine + plugin Compose v2, ajout de l'user qui pilote ARC au groupe `docker`.

Ces rôles préparent la machine cible pour `coolify` / `ai-stack` (ANSIBLE-001b) et `sandbox` / `backups` (ANSIBLE-001c). Le stub `playbooks/setup.yml` reste fonctionnel : à la fin de 001a, il invoque les rôles `hardening` + `docker` (et plus seulement le `debug` no-op).

## Critères d'acceptation

- [ ] Arborescence créée sous `packages/arc-cli/playbooks/roles/` :
  ```
  roles/
  ├── hardening/
  │   ├── tasks/main.yml
  │   ├── handlers/main.yml
  │   └── defaults/main.yml
  └── docker/
      ├── tasks/main.yml
      ├── handlers/main.yml
      └── defaults/main.yml
  ```
- [ ] **Rôle `hardening`** :
  - [ ] UFW installé (`apt`), default deny incoming / allow outgoing, autorise OpenSSH + 80 + 443, activé
  - [ ] fail2ban installé, jail `sshd` enabled, service démarré + enabled
  - [ ] `/etc/ssh/sshd_config` : `PasswordAuthentication no` et `PermitRootLogin prohibit-password` (via `ansible.builtin.lineinfile` ou drop-in `/etc/ssh/sshd_config.d/99-arc.conf`), reload via handler
  - [ ] `unattended-upgrades` installé + activé pour les mises à jour de sécurité
  - [ ] Idempotent : second run = `changed=0`
- [ ] **Rôle `docker`** :
  - [ ] Repo apt officiel Docker ajouté (clé GPG + sources.list.d) pour Ubuntu/Debian
  - [ ] Paquets installés : `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, `docker-compose-plugin`
  - [ ] Service `docker` démarré + enabled
  - [ ] User cible (var `arc_user`, défaut `ansible_user_id`) ajouté au groupe `docker`
  - [ ] Idempotent : second run = `changed=0`
- [ ] **`playbooks/setup.yml`** mis à jour :
  - [ ] Plus de tâche `debug` no-op du stub
  - [ ] `hosts: localhost`, `connection: local`, `become: yes` (privilégié) — ou `become` ponctuel par tâche si plus propre
  - [ ] `pre_tasks` : `ansible.builtin.assert` que la distro est Ubuntu/Debian (ou skip avec message clair)
  - [ ] `roles:` invoque `hardening` puis `docker`
  - [ ] Le commentaire d'en-tête est mis à jour (plus « STUB no-op » — devient « Phase 1.5 — partielle, ai-stack/coolify/sandbox/backups à venir »)
- [ ] **Tests** :
  - [ ] `ansible-playbook --syntax-check packages/arc-cli/playbooks/setup.yml` passe (commande documentée dans le scratchpad, exécutée à blanc)
  - [ ] `ansible-lint packages/arc-cli/playbooks/` ne remonte aucun warning bloquant (si l'outil est dispo ; sinon noté en gap)
  - [ ] Suite Vitest arc-cli : **toujours 140 verts** (zéro régression, zéro test ajouté côté TS — ce périmètre n'introduit pas de logique TypeScript)
  - [ ] **Smoke test humain** dans une VM jetable ou WSL2 fraîche : `arc setup --apply` exécute le playbook, `ufw status` et `fail2ban-client status sshd` rendent le résultat attendu, `docker version` répond, second run idempotent
- [ ] Lint + typecheck globaux verts (`pnpm lint` + `pnpm typecheck`)

## Fichiers concernés (estimation : 8 fichiers, dont 7 nouveaux)

| Fichier | Action |
|---|---|
| `packages/arc-cli/playbooks/setup.yml` | modification (remplace stub debug par invocation rôles) |
| `packages/arc-cli/playbooks/roles/hardening/tasks/main.yml` | création |
| `packages/arc-cli/playbooks/roles/hardening/handlers/main.yml` | création |
| `packages/arc-cli/playbooks/roles/hardening/defaults/main.yml` | création |
| `packages/arc-cli/playbooks/roles/docker/tasks/main.yml` | création |
| `packages/arc-cli/playbooks/roles/docker/handlers/main.yml` | création |
| `packages/arc-cli/playbooks/roles/docker/defaults/main.yml` | création |
| `packages/arc-cli/package.json` | vérif `files` inclut bien `playbooks/**` (déjà fait en INSTALL-002 sous-tâche 2 — à confirmer) |

⚠️ **8 fichiers** = limite haute autorisée par CLAUDE.md. Si l'un des deux rôles déborde (ex: hardening qui se fragmente en `hardening/tasks/ufw.yml` + `hardening/tasks/ssh.yml` + `hardening/tasks/main.yml` qui les `include_tasks`), STOP et redécoupe en ANSIBLE-001a-bis.

## ADRs liés

- **ADR-0008** — Trois réseaux Docker isolés (le rôle `docker` installe Docker, les réseaux eux-mêmes sont créés en ANSIBLE-001c)
- **ADR-0011** — Critères B10 (hardening UFW/fail2ban/sshd `PasswordAuthentication no`) + A4 (`arc setup` idempotent)
- **ADR-0012** — Single-machine (`hosts: localhost`, `connection: local`)
- **ADR-0015** — Layout `~/.arc/` (rôles ne touchent **pas** à `~/.arc/`, ils sont root-scoped sur `/etc` et `/var`)

## Conventions à respecter

- `coding-style.md` — pas de logique TypeScript ici, mais YAML : 2 espaces, pas de tabs, fully-qualified collections (`ansible.builtin.apt` plutôt que `apt`)
- `testing.md` — la suite Vitest doit rester verte, aucun test n'est désactivé / skippé pour faciliter le dev
- ADR-0015 — ne **rien** écrire sous `~/.arc/` dans ces deux rôles

## Hors scope (NE PAS faire)

- Installer / configurer Coolify (= ANSIBLE-001b)
- Cloner / démarrer `local-ai-packaged` (= ANSIBLE-001b)
- Créer les réseaux Docker `prod_net` / `ai_net` / `sandbox_net` (= ANSIBLE-001c)
- Configurer le cron de backup ou rclone (= ANSIBLE-001c)
- Créer les records DNS Cloudflare (= DNS-001)
- Lancer un E2E sur VM jetable (= E2E-001 ; smoke test humain ≠ E2E automatisé)
- Refactorer `setup/apply.ts` côté TypeScript (déjà OK, ne pas y toucher)
- Auto-installer Ansible si absent (déjà géré par `assertAnsibleInstalled` en INSTALL-002)
- Ajouter de la logique dans `state.json` ou `applyStack` côté TS

## Questions ouvertes à arbitrer avant de coder

1. **Port SSH** : la spec infra §11.3 mentionne « port SSH non standard (paramétrable) ». **Recommandation : on garde 22 par défaut en 001a** (la plupart des cibles RPi/WSL2/VPS y sont déjà), variable `arc_ssh_port` exposée dans `defaults/main.yml` à 22, modifiable plus tard sans casser. Re-paramétrer le port SSH dans le hardening risque de **kicker l'opérateur en plein `arc setup`** si UFW + sshd_config divergent — trop dangereux pour 001a.
2. **`become` global vs ponctuel** : `become: yes` au niveau du play simplifie tout, mais autorise root partout. **Recommandation : `become: yes` au niveau du play**, parce que les deux rôles 001a sont 100 % root-scoped (`/etc/ufw`, `/etc/fail2ban`, `/etc/ssh`, install Docker). Plus propre que de répéter `become` sur chaque task. À reconsidérer si un futur rôle (ex: `ai-stack` qui clone dans `~/local-ai-packaged`) doit dropper en user.
3. **Distro support** : Ubuntu 24.04 est la cible primaire (ADR-0011 A3). Doit-on aussi gérer Debian 12 ? **Recommandation : Ubuntu + Debian via `ansible.builtin.assert` que `ansible_os_family == "Debian"`**, sans test différentiel. Un futur rôle `arch-linux` ou `fedora` = nouvelle tâche.
4. **`docker-compose-plugin` vs `docker-compose` standalone** : le repo officiel Docker fournit le plugin v2 (`docker compose ...`). **Recommandation : plugin v2 uniquement** — c'est ce qu'utilise INSTALL-002 (`docker compose -f ~/.arc/compose/...`). Pas de standalone v1 en parallèle.

## Plan d'implémentation

### Sous-tâche 1 : Squelette `roles/` + cadrage `setup.yml`
- Fichiers : `playbooks/roles/hardening/{tasks,handlers,defaults}/main.yml` (création vide initiale), `playbooks/roles/docker/{tasks,handlers,defaults}/main.yml` (idem), `playbooks/setup.yml` (refactor stub → squelette `roles:` vide + assertion distro)
- Effort : ~15 min
- Détail : crée l'arborescence (6 fichiers `.yml` placeholders avec `---` + commentaire), bascule `setup.yml` sur `become: yes` + `pre_tasks: assert ansible_os_family == "Debian"` + `roles: [hardening, docker]`. À ce stade `--syntax-check` doit passer même si les rôles sont vides. Vérifie que `package.json#files` inclut bien `playbooks/**` (héritage INSTALL-002 sous-tâche 2).

### Sous-tâche 2 : Rôle `hardening` — UFW
- Fichiers : `playbooks/roles/hardening/{tasks,handlers,defaults}/main.yml`
- Effort : ~25 min
- Détail : `defaults` expose `arc_ssh_port: 22`. `tasks` : install `ufw` (apt), `community.general.ufw` rules (default deny incoming/allow outgoing, allow OpenSSH/80/443 in), `state: enabled`. Idempotence vérifiée mentalement : second run = `changed=0` sur tous les modules. Pas de handler nécessaire (UFW reload est inclus dans le module).

### Sous-tâche 3 : Rôle `hardening` — fail2ban + SSH + unattended-upgrades
- Fichiers : `playbooks/roles/hardening/{tasks,handlers}/main.yml` (extension)
- Effort : ~25 min
- Détail :
  - install `fail2ban` + service `started, enabled`. Jail `sshd` enabled via drop-in `/etc/fail2ban/jail.d/sshd-arc.local`, handler `restart fail2ban`.
  - SSH : drop-in `/etc/ssh/sshd_config.d/99-arc.conf` avec `PasswordAuthentication no` + `PermitRootLogin prohibit-password`, handler `reload sshd`. **Pas de modification in-place** de `sshd_config` (plus safe contre les régressions distro).
  - `unattended-upgrades` : install paquet, copie `/etc/apt/apt.conf.d/20auto-upgrades` minimal (`Update-Package-Lists "1"; Unattended-Upgrade "1";`).
  - Idempotence : second run = `changed=0`.

### Sous-tâche 4 : Rôle `docker` — repo + install + groupe
- Fichiers : `playbooks/roles/docker/{tasks,handlers,defaults}/main.yml`
- Effort : ~25 min
- Détail :
  - `defaults` expose `arc_user: "{{ ansible_user_id }}"`.
  - `tasks` : ajout clé GPG Docker (download via `ansible.builtin.get_url` vers `/etc/apt/keyrings/docker.asc`, mode 0644), ajout repo `/etc/apt/sources.list.d/docker.list` avec `{{ ansible_distribution | lower }}` + `{{ ansible_distribution_release }}`, `apt update` (ponctuel, pas global), install `[docker-ce, docker-ce-cli, containerd.io, docker-buildx-plugin, docker-compose-plugin]`.
  - Service `docker` : `started, enabled`.
  - User : `ansible.builtin.user name={{ arc_user }} groups=docker append=yes`.
  - Idempotence : second run = `changed=0`.

### Sous-tâche 5 : Validation — syntax-check, ansible-lint si dispo, smoke humain
- Fichiers : aucun changement code, scratchpad `current.md` enrichi
- Effort : ~20 min
- Détail :
  - Run `ansible-playbook --syntax-check packages/arc-cli/playbooks/setup.yml` → exit 0.
  - Run `ansible-lint packages/arc-cli/playbooks/` si l'outil est dispo (sinon noter en CLI gap).
  - Run `pnpm test --filter @euglowlabs/arc-cli` → 140 verts (zéro régression).
  - Run `pnpm lint && pnpm typecheck` racine → verts.
  - **Smoke humain** : tu (l'utilisateur) lances `arc setup --apply` dans une WSL2 ou VM jetable Ubuntu 24.04 fraîche, vérifies `ufw status numbered`, `fail2ban-client status sshd`, `docker version`, `groups $USER` (contient `docker`), puis re-run pour idempotence (`changed=0` côté Ansible recap).
  - Si le smoke échoue → fix en sous-tâche 6 imprévue, sinon clôture.

## Notes pour ANSIBLE-001b (à lire au démarrage de 001b)
- 001a laisse `setup.yml` avec `roles: [hardening, docker]`. 001b ajoute `coolify` puis `ai-stack` à la suite.
- Le repo apt Docker + le plugin compose v2 sont en place : 001b peut directement `docker compose -f ...` sans réinstaller.
- L'user pilote est dans le groupe `docker` après run hardening : 001b peut dropper `become: yes` dans les rôles `coolify`/`ai-stack` si besoin (mais probablement pas nécessaire avant le rôle `sandbox` en 001c).

## Scratchpad

### Décisions actées avant code (2026-05-05, validées utilisateur)
- **Q1 — Port SSH** : 22 par défaut, variable `arc_ssh_port` exposée. **Règle UFW utilise `{{ arc_ssh_port }}` pas `22` en dur.** Gestion transition open-new-before-close-old → 001b/c.
- **Q2 — `become`** : `become: yes` global au play en 001a. 001b/c raffineront par rôle si nécessaire (Coolify peut être mixed scope).
- **Q3 — Distro** : `assert ansible_os_family == "Debian"` (Ubuntu + Debian). Warning non-bloquant si distro != Ubuntu 24.04. Durcissement futur si bugs Debian.
- **Q4 — Docker Compose** : plugin v2 uniquement (`docker-compose-plugin`). Test post-install : `docker compose version` retourne `2.x.x`. **Pas de purge auto** de v1 résiduel.
- **Q5 — UFW IPv6** : `IPV6=yes` dans `/etc/default/ufw`.
- **Q6 — Ports UFW** : 22/80/443 uniquement. Pas d'ouverture 8000 (Coolify dashboard reste localhost-only, accès SSH tunnel). Commentaire en tête de `roles/hardening/tasks/main.yml` expliquant cette politique.
- **Q7 — fail2ban jails** : `sshd` + `recidive` uniquement en 001a. `maxretry=5`, `bantime=1h`, recidive `bantime=1 semaine`. Pas d'apache/nginx. Documenter `fail2ban-client set <jail> unbanip <ip>` en commentaire YAML.
- **Q8 — unattended-upgrades** : security only. `Automatic-Reboot "false"`. `Allowed-Origins` limité à `${distro_id}:${distro_codename}-security`.

## CLI gaps

- Mettre à jour `docs/04-conventions/naming.md` pour documenter la convention de suffixe `a/b/c` (fix regex commit-msg fait via [INFRA-006], doc à aligner).
- Créer `packages/arc-cli/playbooks/requirements.yml` pour pinner les collections Ansible nécessaires (au minimum `community.general` requise par `community.general.ufw` utilisé en sous-tâche 2 d'ANSIBLE-001a). À traiter avant ANSIBLE-001b ou en tâche dédiée. Tant que ce n'est pas fait, le smoke test exige `apt install ansible` (full) côté cible — `ansible-core` seul fera planter `community.general.*`.
- Si demande user future : exposer `arc_unattended_allow_general_updates` / `arc_unattended_auto_reboot` (figés YAGNI en 001a sous-tâche 3 — Q8 = security-only + no auto-reboot).
- Si élargissement aux distros RedHat plus tard (Fedora/RHEL/Rocky) : conditionner `service name: ssh` (Debian/Ubuntu) → `sshd` (RedHat) sur `ansible_os_family`. Idem `apt`/`dnf`. Hors scope ANSIBLE-001 (assert Debian-family suffit).
- Refacto possible : monter `arc_user` au play level dans `setup.yml` `vars:` (déduplication entre rôles `hardening` + `docker`, expression identique aujourd'hui). YAGNI 001a, à acter en 001b/c.
