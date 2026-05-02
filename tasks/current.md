# Tâche en cours : CLI-012 — Commande `arc deploy`

## Statut
🟡 En cours — démarrée le 2026-05-02

## Objectif
Orchestrer le déploiement : load config → select adapter → render 4 templates (prod, sandbox, agents, env) → write sur l'adapter → `docker compose up -d`. Ansible reste pour CLI-013.

## Critères
- [ ] `arc deploy` commande clipanion, flags `--out-dir` (défaut `./.arc/generated`)
- [ ] Loads `arc.config.yml` via `loadArcConfig`
- [ ] Sélectionne adapter selon `target` (Local/VPS)
- [ ] Render des 4 templates + write via `adapter.copyFile` (en passant par tmp file local)
- [ ] Run `docker compose -f f1 -f f2 -f f3 --env-file .env up -d`
- [ ] Tests via `MockAdapter`
- [ ] CI verte, PR mergée

## Hors scope
Ansible (CLI-013), state management (CLI-014), provisioning auto Hetzner (CLI-023), Cloudflare Tunnel (CLI-024).

## Plan
1. `deploy.ts` orchestrator (cfg, adapter, opts) → 4 fichiers + compose up (20 min)
2. `DeployCommand` clipanion + wiring (15 min)
3. Tests via MockAdapter (15 min)
4. Vérif + commit + PR (10 min)
