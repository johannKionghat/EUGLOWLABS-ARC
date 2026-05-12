# Tâche en cours : aucune

**DIST-001 ✅ clôturé le 2026-05-12** — archive : `tasks/completed/2026-05-12-DIST-001.md`.

## Prochaine tâche à choisir

Voir `tasks/INDEX.md` ou `tasks/backlog/` pour la liste complète.

### Candidat naturel — CLI-029 (recommandé)

`tasks/backlog/CLI-029-auto-bootstrap-system-prerequisites.md`

Pourquoi prioritaire :
- 🔴 **Bloque le tag stable v0.1.0** (cf. rapport de completion DIST-001 §"Décision : v0.1.0 stable NON taggé")
- Critique pour l'expérience end-user : aujourd'hui, `arc setup --apply` plante si Ansible n'est pas pré-installé → contredit ADR-0011 A3 ("sans intervention manuelle entre les questions")
- Estimé ~4h cumulées sur 4-5 sous-tâches
- Débloque la livraison **complète** du smoke E2E 1f-B (mis en pause sur DIST-001)

### Autres candidats backlog

- 🔵 **LOCAL-001** — mode `--mode local` pour WSL/laptop dev (élargit marché cible). Indépendant de CLI-029.
- ⬜ **DIST-002/003/004** — cosign signing / `arc self-update` / darwin+windows builds. Tous reportés post-Chantier-1 / post-bêta.

## Workflow pour démarrer une tâche

1. Choisir la tâche dans `tasks/INDEX.md` ou `tasks/backlog/`
2. Lancer `/arc-task-start` (skill) — active la tâche dans `tasks/current.md`
3. Proposer un plan d'implémentation
4. Attendre validation utilisateur avant de coder
