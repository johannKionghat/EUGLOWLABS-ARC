# Aucune tâche active — prête à démarrer DOC-001

## État global du Chantier 1
- **Phase 0** : 10/10 ✅
- **Phase 1** : 28/28 ✅ *(modèle dual ADR-0009 — refactoré en Phase 1.5)*
- **Phase 1.5** : 3/8 ✅ — REFACTOR-001/002/003 mergés sur `main` (commit `b144c72`). Restant : DOC-001, INSTALL-001, ANSIBLE-001, DNS-001, E2E-001
- **Phase 2** : 0/14 (ARC Agent Go, auth = token local statique)
- **Phase 3** : 0/15 (Dashboard Niveau 1 self-hosted)
- **Phase 4** : 0/7 (VALIDATE-001 à 007 — validation infra à vide)

## Prochaine tâche : **DOC-001**

**Titre** : `docs/migration-guide.md` — guide migration utilisateur (livrable critique Chantier 1).

**Pourquoi maintenant** : seul artefact côté produit qui mitige les risques **P2** (perte de scénario migration `arc deploy --target=vps`) et **P3** (perte du cas "machine sans IP publique" / Cloudflare Tunnel CLI) actés dans [ADR-0012](../docs/03-architecture-decisions/0012-single-machine-install.md). Le passage Chantier 1 → Chantier 2 exige que ce guide soit testé à blanc (cf. `tasks/CHANTIER-1-VALIDATION.md`).

**Couvre 6 sections obligatoires** :
- §1 — Migrer une app existante vers ARC (3 cas : Next.js+Postgres / Supabase / Vercel KV+Blob) → critère C1 ADR-0011
- §2 — Déplacer un projet d'une instance ARC à une autre (`arc backup` → `scp` → `arc restore`)
- §3 — Dupliquer une instance ARC en staging
- §4 — Installer ARC sans IP publique (RPi / WSL2 + cloudflared manuel) → mitigation P3
- §5 — Rollback (`arc restore <backup-id>`)
- §6 — Troubleshooting (5 cas fréquents : DNS, Let's Encrypt, Coolify, Postgres OOM, sandbox)

**Démarrer** :
    /arc-task-start DOC-001

## Référence post-merge
- HEAD `main` : `b144c72 refactor: migrate to single-machine install model (ADR-0012)`
- Branche `backup/before-adr-0012` conservée 30 jours (à supprimer après validation Phase 4)
- CLI `arc` à ce jour : `version`, `help`, `init`, `deploy`, `status`, `logs`, `restart`, `backup`, `restore`, `project add|list|deploy`, `config telemetry`. **`arc setup` à venir** (INSTALL-001).
