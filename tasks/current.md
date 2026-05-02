# Tâche : CLI-014 — State management `.infra/state.json`

## Statut
🟡 En cours — 2026-05-02

## Objectif
Source de vérité local de ce qui a été déployé. Lecture, écriture, diff. Spec-infra §5.3 layer "State `.infra/state.json`".

## Critères
- [ ] Schéma zod du state (project, lastDeploy, services, files written)
- [ ] `readState(path)`, `writeState(path, state)`, `diffState(prev, next)`
- [ ] Tests sur tmpdir
- [ ] CI verte, PR mergée

## Plan
1. Schéma + types (10 min)
2. read/write/diff (20 min)
3. Tests (15 min)
4. Vérif + PR (10 min)
