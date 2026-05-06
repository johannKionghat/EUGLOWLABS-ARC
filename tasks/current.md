# Aucune tâche active

Pour démarrer une tâche, lance :

    /arc-task-start [TASK-ID]

Prochaine tâche suggérée : **ANSIBLE-001c** — rôles `sandbox` (3 réseaux Docker ADR-0008) + `backups` (cron + rclone Cloudflare R2) + `setup.yml` final orchestrant les 5 rôles.

Pré-requis avant 001c : aucun (`requirements.yml` couvre déjà `community.docker >=3.5,<4.0` qui inclut `community.docker.docker_network` pour les 3 réseaux).

CLI gaps actifs hérités d'ANSIBLE-001a/001b à traiter au moment opportun (cf. `tasks/completed/2026-05-07-ANSIBLE-001b.md` section « CLI gaps »).
