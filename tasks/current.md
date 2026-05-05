# Aucune tâche active

Pour démarrer une tâche, lance :

    /arc-task-start [TASK-ID]

## Phase 1.5 — restant
- ⬜ **ANSIBLE-001** — Rôles Ansible (hardening UFW + fail2ban, docker, coolify, ai-stack, sandbox, backups) exécutés en `localhost`. Stub `playbooks/setup.yml` à remplacer (livré par INSTALL-002).
- ⬜ **DNS-001** — Cloudflare DNS records via API (A wildcard pointant sur l'IP publique de la machine).
- ⬜ **E2E-001** — Test bout-en-bout sur VM jetable (CI nightly, ~0,02 €/run). Critère supplémentaire : valider empiriquement les commandes critiques de `docs/migration-guide.md` et `docs/install-without-public-ip.md`.

## Prochaine tâche recommandée
**ANSIBLE-001** — 3-5h sur 2 sessions.
Aucune dépendance bloquante (le stub playbook posé par INSTALL-002 sera remplacé).
**Recommandation** : pause ≥ quelques heures avant d'attaquer, tête fraîche.

## Notes léguées par INSTALL-002 (à lire avant ANSIBLE-001)
- **Contrat transactionnel posé par `applyStack`** :
  - rename `.tmp/`→final est exécuté AVANT l'invocation Ansible. Les rôles peuvent lire les composes via `docker compose -f ~/.arc/compose/docker-compose.X.yml`.
  - `state.json` = commit marker. ANSIBLE-001 ne doit PAS écrire dans `state.json` (c'est `applyStack` qui le fait sur retour 0 du playbook).
  - Si playbook échoue : composes restent en place pour inspection user. Idempotence prompt sur run suivant détectera le "reset partiel" via le wording "Composes existants détectés".
- **Composes attendus** : `docker-compose.{prod,sandbox,agents}.yml` sous `~/.arc/compose/` (chmod 0700 dir, 0600 files).
- **CLI gap CLI-025** : bundling `bun build --compile` du playbook (et futurs rôles sous `playbooks/roles/`) à valider avant E2E-001 sur VM jetable.

## CLI gaps notés pour le futur
- `arc setup --reconfigure` (mentionné dans la doc, pas encore livré).
- `arc setup --skip-dns` (référencé dans `install-without-public-ip.md`, désormais possible).
- CLI-025 bundling playbook pour single binary `bun --compile`.
