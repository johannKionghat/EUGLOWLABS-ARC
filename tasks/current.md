# Aucune tâche active — prête à démarrer INSTALL-001

## État global du Chantier 1
- **Phase 0** : 10/10 ✅
- **Phase 1** : 28/28 ✅ *(modèle dual ADR-0009 — refactoré en Phase 1.5)*
- **Phase 1.5** : 4/8 ✅ — REFACTOR-001/002/003 + DOC-001. Restant : INSTALL-001, ANSIBLE-001, DNS-001, E2E-001
- **Phase 2** : 0/14 (ARC Agent Go, auth = token local statique)
- **Phase 3** : 0/15 (Dashboard Niveau 1 self-hosted)
- **Phase 4** : 0/7 (VALIDATE-001 à 007 — validation infra à vide)

## Prochaine tâche : **INSTALL-001**

**Titre** : Commande `arc setup` all-in-one (questions interactives → écrit `~/.arc/arc.config.yml` → exécute Ansible local → bootstrap stack).

**Pourquoi maintenant** :
1. Débloque la dernière section utile de `docs/install-without-public-ip.md` §6 (tout le reste de DOC-001 est déjà actionnable).
2. Conditionne les commandes `arc setup` référencées partout dans `migration-guide.md` (étapes "pré-flight", §3 staging install).
3. Critère **A3** d'ADR-0011 : "`arc setup` mène à une stack fonctionnelle en moins de 15 minutes sur un VPS Ubuntu 24.04 vierge". Sans `arc setup`, ce critère est inatteignable.
4. INSTALL-001 est **sur le chemin critique** des phases 2/3/4 — Agent + Dashboard + VALIDATE-* dépendent tous d'une instance ARC démarrable.

**Scope court** :
- Implémenter la commande `arc setup` (Bun + clipanion) qui :
  - Pose les questions interactives via `@clack/prompts` (project name, domain, email, dns provider, R2 backup target)
  - Écrit `~/.arc/arc.config.yml` après validation zod (schéma déjà figé en `arc-shared`)
  - Exécute le playbook Ansible **en localhost** (cible : machine hôte, pas de SSH outbound — cf. ADR-0012)
  - Idempotent : un second appel doit converger sans casse
- Hors scope INSTALL-001 (à livrer ailleurs) :
  - Les rôles Ansible eux-mêmes (= ANSIBLE-001)
  - Création des records DNS Cloudflare (= DNS-001)
  - Tests E2E sur VM jetable (= E2E-001)

**Démarrer** :

    /arc-task-start INSTALL-001

## Référence post-merge DOC-001
- Branche : `main` (commit final à venir).
- Documents livrés : `docs/migration-guide.md` (1564 l) + `docs/install-without-public-ip.md` (344 l) + `docs/03-architecture-decisions/0014-doc-target-persona.md`.
- Note de relecture future : les références à `arc setup --skip-dns` et à la procédure §6 d'`install-without-public-ip.md` doivent être complétées dès qu'INSTALL-001 est mergée.

## CLI à ce jour (post-DOC-001, pré-INSTALL-001)
`version`, `help`, `init`, `deploy`, `status`, `logs`, `restart`, `backup`, `restore`, `project add|list|deploy`, `config telemetry`. **`arc setup` à venir avec INSTALL-001.**
