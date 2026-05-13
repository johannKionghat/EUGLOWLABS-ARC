# Tâche en cours : aucune

**CLI-029 ✅ clôturé le 2026-05-14** (partial — scope strict atteint, 1e reporté à CLI-031).
Archive : `tasks/completed/2026-05-14-CLI-029.md`.

## Prochaine tâche à choisir

Voir `tasks/INDEX.md` ou `tasks/backlog/` pour la liste complète.

### Candidat naturel — CLI-031 (recommandé)

`tasks/backlog/CLI-031-embed-compose-templates-in-binary.md`

Pourquoi prioritaire :
- 🔴 **Bloque le tag stable v0.1.0** (cf. rapport completion CLI-029 §"Décision tag v0.1.0 stable — encore SKIP")
- Complète le pipeline ADR-0011 A3 self-driving (CLI-029 a fait le bootstrap, CLI-031 finit la compose generation)
- Bug détecté in-vivo pendant smoke CLI-029 1d → contexte frais
- Pattern de fix éprouvé (DIST-001 1a-2 codegen → manifest TypeScript)
- Estimé ~2h sur 5 sous-tâches

### Autres candidats backlog

- ⬜ **CLI-030** — `arc uninstall` (gap noté pendant CLI-029 1d, à ouvrir si pas encore créé)
- ⬜ **A11 ADR-0011** — `arc destroy` (critère Chantier 1 non-livré)
- 🔵 **LOCAL-001** — mode `--mode local` pour WSL/laptop (orthogonal)
- ⬜ **DIST-002/003/004** — cosign / self-update / darwin+windows builds (backlog post-Chantier-1 / post-bêta)

## Workflow pour démarrer une tâche

1. Choisir dans `tasks/INDEX.md` ou `tasks/backlog/`
2. Lancer `/arc-task-start CLI-031` (skill) — active la tâche dans `tasks/current.md`
3. Proposer un plan d'implémentation
4. Attendre validation utilisateur avant de coder
