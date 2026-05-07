# Aucune tâche active

Pour démarrer une tâche, lance :

    /arc-task-start [TASK-ID]

Prochaine tâche suggérée : **E2E-001** — Test bout-en-bout sur VM jetable Ubuntu 24.04. C'est la dernière tâche de la Phase 1.5 — elle valide empiriquement les **~30 critères runtime reportés** depuis ANSIBLE-001a/b/c + DNS-001 (idempotence ×6 rôles, networks Docker isolés, healthchecks runtime Coolify/Supabase/Ollama, backups réels chiffrés sur R2 + restore, DNS records sur vrai zone Cloudflare, smoke humain global).

Pré-requis pour E2E-001 :
- Compte Cloudflare avec API token (`Zone:DNS:Edit` scope) + zone de test
- VPS jetable Ubuntu 24.04 (Hetzner, OVH, Scaleway — ~5 €/mois prorated)
- Compte Cloudflare R2 avec bucket + access keys (test backups round-trip)

Recommandation : E2E-001 = validation runtime, pas du dev. Reprendre frais.

CLI gaps actifs hérités d'ANSIBLE-001a/b/c + DNS-001 à traiter au moment opportun (cf. `tasks/completed/2026-05-07-DNS-001.md` section « CLI gaps »).
