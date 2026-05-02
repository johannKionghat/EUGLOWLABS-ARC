# Tâche : CLI-013 — Intégration Ansible

## Statut
🟡 En cours — 2026-05-02

## Objectif
Wrapper TS qui invoque `ansible-playbook` via l'adapter et stream son output ligne par ligne. Pas de playbooks complets (rôles hardening/docker/coolify reportés à des tâches dédiées) — juste l'API d'invocation + skeleton de playbook + tests.

## Critères
- [ ] `runAnsiblePlaybook(adapter, playbookPath, opts)` retourne `{ exitCode, durationMs }`
- [ ] Forward des `extraVars` et `inventory`
- [ ] Stream output via callback
- [ ] Skeleton `ansible/playbook.yml` minimal versionné
- [ ] Tests MockAdapter
- [ ] CI verte, PR mergée

## Hors scope
Rôles Ansible complets, exécution réelle d'Ansible en CI, intégration dans `arc deploy` (future task), Galaxy.

## Plan
1. `src/ansible/run.ts` (15 min)
2. Skeleton `ansible/playbook.yml` à la racine du package (5 min)
3. Tests MockAdapter (10 min)
4. Vérif + commit + PR (10 min)
