# Aucune tâche active

Pour démarrer une tâche, lance :

    /arc-task-start [TASK-ID]

Prochaine tâche suggérée : **DNS-001** — Cloudflare API integration pour records DNS automatiques (A wildcard pointant sur l'IP publique).

Pré-requis : compte Cloudflare avec API token (variable d'env ou `~/.arc/credentials/cloudflare.env`). Hors Ansible — scope CLI ou shell-out.

**Phase 1.5 Ansible : COMPLÈTE** (6 rôles livrés via ANSIBLE-001a/b/c). Reste DNS-001 + E2E-001 pour fermer le Chantier 1.

12 CLI gaps actifs hérités d'ANSIBLE-001a/b/c à traiter au moment opportun (cf. `tasks/completed/2026-05-07-ANSIBLE-001c.md` section « CLI gaps »).
