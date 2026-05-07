# Aucune tâche active

🎯 **Phase 1.5 COMPLETE — 11/11. Chantier 1 fermé côté code et documentation.**

## Action immédiate suggérée pour l'utilisateur

Exécuter la procédure E2E sur un VPS jetable pour valider empiriquement les ~30 critères runtime de Phase 1.5 :

1. Provisionner VPS Ubuntu 24.04 (Hetzner/OVH/Scaleway, ~5 € prorated)
2. SSH + clone repo + `arc setup --apply`
3. `sudo bash scripts/smoke-test.sh`
4. Suivre `docs/E2E-test-procedure.md` (sections mandatory + optionnels selon credentials Cloudflare/R2 disponibles)

## Si une commande échoue pendant le smoke réel

Ouvrir une fix task dédiée avec ID approprié :
- `INSTALL-002` pour bug TypeScript CLI
- `ANSIBLE-001a-fix-X` pour rôle Ansible (1a hardening, 1b coolify/ai-stack, 1c sandbox/backups)
- `DNS-001-fix-X` pour `arc dns *`
- `DOC-001` pour documentation qui ment

## Phases suivantes (hors session actuelle)

- **Chantier 2** — Sentinel (Go agent), gelé jusqu'à `"go chantier 2"` user (cf. ADR-0013)
- **Phase 2** — multi-host, load testing, audit sécurité externe (hors scope MVP)

21 CLI gaps actifs documentés dans `tasks/completed/2026-05-07-E2E-001.md` section « CLI gaps », à traiter au moment opportun.

Pour démarrer une tâche :

    /arc-task-start [TASK-ID]
