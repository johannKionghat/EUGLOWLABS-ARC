# INSTALL-001b — `arc setup` exécution stack

## Statut
⬜ Backlog — démarrer après INSTALL-001a ✅

## Objectif
Compléter `arc setup` (squelette livré par INSTALL-001a) avec : détection de `ansible-playbook` sur PATH, invocation d'un playbook stub via `runAnsiblePlaybook` existant, génération des composes maison sous `~/.arc/compose/` (cf. ADR-0015) à partir des templates Phase 1. Le playbook réel reste à ANSIBLE-001.

## Critères d'acceptation
- [ ] Fonction `assertAnsibleInstalled(adapter)` : exec `ansible-playbook --version`, message d'erreur balisé si absent (pas d'auto-install — hors scope).
- [ ] Stub `playbooks/setup.yml` créé : play `localhost` qui imprime un message `⏳ ARC setup playbook is currently a STUB. Real installation logic will be provided by ANSIBLE-001. This stub returns success to allow testing of the orchestration layer. See tasks/INDEX.md for ANSIBLE-001 status.` puis exit 0.
- [ ] Génération des composes sous `~/.arc/compose/` (mode 0755) à partir des templates `prod-compose`, `sandbox-compose`, `agents-compose`.
- [ ] Tests Vitest E2E : config existante → composes générés → playbook stub OK → exit 0. MockAdapter pour Ansible, fs réel sur `tmp/` ou memfs.
- [ ] `arc help` mentionne `arc setup` complet avec exemples.
- [ ] `pnpm test` + `pnpm lint` + `pnpm typecheck` verts.
- [ ] Une ligne ajoutée dans le tableau commandes du README racine.

## Fichiers concernés (estimation)
- `packages/arc-cli/src/setup/orchestrate.ts` (extension de la version 001a)
- `packages/arc-cli/src/setup/orchestrate.test.ts` (extension)
- `packages/arc-cli/src/paths.ts` (création — helper `arcUserDir()`, `arcComposeDir()`, etc., cf. ADR-0015)
- `playbooks/setup.yml` (création stub)
- `packages/arc-cli/src/commands/setup.ts` (compléter `Command.Usage`)
- `README.md` (racine, ligne tableau)

## ADRs liés
- **ADR-0011** — Critère **A3** (`arc setup` < 15 min sur Ubuntu 24.04). Le stub de INSTALL-001b ne valide pas A3 par lui-même — A3 sera atteint avec ANSIBLE-001 + E2E-001.
- **ADR-0012** — Single-machine, `ansible-playbook` en `localhost`.
- **ADR-0015** — Layout `~/.arc/compose/` (créé en cours d'INSTALL-001a).

## Hors scope
- Rôles Ansible eux-mêmes (= ANSIBLE-001).
- Auto-install de `ansible-playbook` si absent.
- Création des records DNS Cloudflare (= DNS-001).
- Tests E2E sur VM jetable (= E2E-001).

## Plan provisoire (à raffiner au démarrage via `/arc-task-start INSTALL-001b`)
1. Helper `paths.ts` (arcUserDir, arcComposeDir, arcCredentialsDir) si pas livré dans 001a.
2. Détection `ansible-playbook` + message d'erreur balisé.
3. Stub `playbooks/setup.yml` + invocation via `runAnsiblePlaybook`.
4. Génération composes sous `~/.arc/compose/` via templates existants.
5. Tests E2E config existante → composes + Ansible stub.
6. Doc in-source + README.

## Dépendance
INSTALL-001a doit être ✅ avant. Au moment du démarrage, vérifier que la commande `arc setup` répond (squelette livré) et que la config peut s'écrire dans `~/.arc/arc.config.yml`.
