# Aucune tâche active — Phase 1 CLI MVP terminée 🎉

## Phase 1 — bilan
**28/28 ✅**, **30 PRs mergées sans rollback**, ~75 tests Vitest verts.

Le CLI `arc` couvre désormais l'intégralité du parcours utilisateur :
- `version` / `help` (banner ASCII)
- `init` interactif → `arc.config.yml`
- Schéma zod + loader + générateur YAML
- 3 templates Compose (prod / sandbox / agents) + `.env`
- Adapters Local + VPS + Mock + provisioning Hetzner
- `deploy`, `status`, `logs`, `restart`
- `backup`, `restore`, upload R2 (rclone)
- `project add` / `list` / `deploy` (Coolify API)
- `migrate` (local → VPS)
- Cloudflared tunnel auto
- Single binary cross-target via Bun
- Workflow npm publish + Homebrew formula
- `install.sh` curl-friendly
- Telemetry opt-in (OFF par défaut)

## Pour démarrer une tâche
    /arc-task-start [TASK-ID]

## Prochaines tâches suggérées

- **AGENT-001** → ouvrir Phase 2 (skeleton Go ARC Agent)
- **DASH-001** → Phase 3 (Next.js dashboard)
- **INFRA-008/009/010** → finir Phase 0 (Changesets, README, release workflow)

## État global du projet
- Phase 0 : 7/10 (INFRA-008/009/010 restants, repoussables)
- Phase 1 : **28/28 ✅**
- Phase 2 : 0/14
- Phase 3 : 0/15
- Phase 4 : 0/14
- Phase 5 : 0/7
- Phase 6 : 0/8
- Phase 7 : 0/8
- Phase 8 : 0/9
- **Total : 35/113 tâches**
