# Aucune tâche active — prête à démarrer INSTALL-002 ou ANSIBLE-001

## État global du Chantier 1
- **Phase 0** : 10/10 ✅
- **Phase 1** : 28/28 ✅ *(modèle dual ADR-0009 — refactoré en Phase 1.5)*
- **Phase 1.5** : 5/9 ✅ — REFACTOR-001/002/003 + DOC-001 + INSTALL-001. Restant : INSTALL-002, ANSIBLE-001, DNS-001, E2E-001
- **Phase 2** : 0/14 (ARC Agent Go, auth = token local statique)
- **Phase 3** : 0/15 (Dashboard Niveau 1 self-hosted)
- **Phase 4** : 0/7 (VALIDATE-001 à 007 — validation infra à vide)

## Prochaine session — question stratégique à trancher

INSTALL-002 et ANSIBLE-001 sont **couplées** : INSTALL-002 invoque le playbook que ANSIBLE-001 doit produire. Deux options à arbitrer en début de session suivante :

### Option A — ANSIBLE-001 d'abord, puis INSTALL-002
- **Pour** : produit le code "réel" (rôles Ansible) avant de l'invoquer ; permet de valider chaque rôle indépendamment ; INSTALL-002 devient un wrapper trivial.
- **Contre** : ANSIBLE-001 demande accès à une VM jetable pour tester réellement ses rôles, ce qui pré-charge E2E-001 sans qu'on l'ait livré. Risque de tâtonnement long sur le hardening Ansible sans cadre d'invocation.

### Option B — INSTALL-002 d'abord avec stub no-op + ANSIBLE-001 remplit ensuite
- **Pour** : cohérent avec la stratégie déjà adoptée (`playbooks/setup.yml` stub no-op planifié dans `tasks/backlog/INSTALL-002.md`) ; INSTALL-002 livrable sans dépendance forte ; ANSIBLE-001 peut alors être attaqué avec un cadre d'invocation testable.
- **Contre** : produit du code "non utile" (stub) qui sera réécrit ; double bascule code en cours de Phase 1.5.

**Pas urgent** — à trancher en début de prochaine session. Le mémo doit ouvrir la session avec un `/arc-task-start INSTALL-002` ou `/arc-task-start ANSIBLE-001` selon le choix.

## Référence post-merge INSTALL-001
- Commits sur `main` : `e8f8f9b` → `c5d42d6` + commit d'archivage à venir.
- Documents livrés : `paths.ts`, `setup/idempotence.ts`, `setup/orchestrate.ts`, `setup/sensitive.ts`, `setup/index.ts`, `commands/setup.ts`, `cli.ts` (modif), 5 fichiers de tests, `docs/03-architecture-decisions/0015-layout-arc-user-artifacts.md`.
- Tests arc-cli : **107 passed + 2 skipped** (vs 71 pré-INSTALL-001).
- Smoke test humain : 4/4 scénarios validés.

## CLI à ce jour (post-INSTALL-001)
`version`, `help`, `init`, **`setup`**, `deploy`, `status`, `logs`, `restart`, `backup`, `restore`, `project add|list|deploy`, `config telemetry`. Sortie de `arc setup` : config écrite dans `~/.arc/arc.config.yml`. **Apply de la stack à venir avec INSTALL-002.**
