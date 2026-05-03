# Aucune tâche active — Phase 1.5 en cours

## État global du Chantier 1
- **Phase 0** : 10/10 ✅
- **Phase 1** : 28/28 ✅ *(modèle dual ADR-0009 — refactoré en Phase 1.5)*
- **Phase 1.5** : 3/8 ✅ — REFACTOR-001/002/003 terminés (single-machine ADR-0012). Restant : DOC-001, INSTALL-001, ANSIBLE-001, DNS-001, E2E-001
- **Phase 2** : 0/14 (ARC Agent Go, auth = token local statique)
- **Phase 3** : 0/15 (Dashboard Niveau 1 self-hosted)
- **Phase 4** : 0/7 (VALIDATE-001 à 007 — validation infra à vide)

## Pour démarrer une tâche
    /arc-task-start [TASK-ID]

## Prochaine tâche suggérée

**DOC-001** — `docs/migration-guide.md` (livrable critique — seul artefact de migration côté produit). Mitigation obligatoire de P2 + P3 d'ADR-0012, pré-requis de la validation Chantier 1. Couvre 6 sections (3 cas de migration, déplacement instance, staging, install sans IP publique, rollback, troubleshooting).

Alternatives si DOC-001 attend du contenu produit :
- **INSTALL-001** — Commande `arc setup` all-in-one
- **ANSIBLE-001** — Rôles Ansible exécutés en `localhost`

## CLI `arc` à ce jour (post-refactor ADR-0012)
`version`, `help`, `init`, `deploy`, `status`, `logs`, `restart`, `backup`, `restore`, `project add|list|deploy`, `config telemetry`. Single binary via Bun, install.sh curl-friendly, Homebrew formula, workflow Changesets en place. **`arc migrate` retiré** (single-machine — ADR-0012). **`arc setup` à venir** (INSTALL-001).
