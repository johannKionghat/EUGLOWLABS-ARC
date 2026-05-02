# Tâche : CLI-015 — `arc status`

## Statut
🟡 En cours — 2026-05-02

## Objectif
Health check : lit l'état + ping `docker compose ps` via adapter, rapporte les services up/down. Surface CLI clipanion.

## Critères
- [ ] `checkStatus(adapter, opts)` fonction pure
- [ ] `StatusCommand` clipanion
- [ ] Tests MockAdapter
- [ ] CI verte, PR mergée

## Plan
1. `checkStatus` (15 min)
2. `StatusCommand` + wiring (10 min)
3. Tests (10 min)
4. Vérif + PR (10 min)
