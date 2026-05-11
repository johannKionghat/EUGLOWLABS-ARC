# ADR-0011 : Critères d'acceptation end-to-end (CLI + Stack + Dashboard Niveau 1)

## Statut
Accepté
Date : 2026-05-03

## Contexte

[ADR-0013](./0013-chantier-1-2-separation.md) fixe que la transition Chantier 1 → Chantier 2 dépend, entre autres, du critère #1 : *"Les critères d'acceptation de l'ADR-0011 sont validés"*.

Cet ADR-0011 énumère les **25 critères** que l'install end-to-end (CLI `arc setup` + Stack déployée + ARC Agent + Dashboard Niveau 1) doit satisfaire pour que le **produit soit livré** — pas pour que les projets de l'auteur soient migrés.

> **Important — Migration des projets ≠ critère de livraison.**
>
> ARC est un produit. Les migrations des projets de l'auteur (EuglowLabs, InfinixUI, InfinixLoop, EduMatch) **ne sont pas des tâches de développement** : ce sont des **actes d'utilisation** que l'auteur réalisera à la main quand le produit sera livré.
>
> Vercel ne livre pas avec une tâche "migrer le site du client X". Vercel livre l'outil, le client l'utilise.
>
> Le seul critère de migration ici est une **capacité** (le produit permet de migrer en moins de 30 minutes en suivant la doc), pas une **réalisation**.

Les critères sont dérivés de la **spec infrastructure** (`docs/01-spec-infra.md`), avec quatre ajustements actés par ADR-0012 (single-machine install) :

- "arc deploy --target=vps" ➜ **`arc setup` sur le VPS**.
- "arc migrate" ➜ **supprimé** (workflow `backup → scp → restore` documenté dans `docs/migration-guide.md` — DOC-001 / P2 ADR-0012).
- "Cloudflare Tunnel mode local" ➜ **supprimé** (l'utilisateur installe `cloudflared` lui-même si pas d'IP publique — section dédiée du guide migration / P3 ADR-0012).
- "Bascule local ↔ vps sans modif" ➜ **supprimé** (single-machine, plus de bascule).

Et le retrait des 4 critères "migration projets" en faveur d'un critère "capacité de migration" :

- "Migration EuglowLabs", "Migration InfinixUI", "Migration InfinixLoop", "Migration EduMatch" ➜ **supprimés**.
- ➕ "Capacité de migration documentée et testée à blanc" (un seul critère).

**Total final : 25 critères.**

## Décision

Le produit est jugé "Chantier 1 fini" lorsque les 25 critères ci-dessous sont **tous validés** par exécution sur un VPS de test fraîchement provisionné.

Si pendant Phase 3 ou Phase 4 un critère doit être amendé, **on crée un ADR-0011-bis explicite**. **Aucune suppression silencieuse**.

## Les 25 critères

### A. CLI — bootstrap et commandes (12 critères)

1. **A1** — `curl -fsSL https://install-arc.euglowlabs.com | sh` télécharge le binaire `arc` et l'installe dans `/usr/local/bin/` sans interaction.
2. **A2** — `arc init` lancé interactivement produit un `~/.arc/arc.config.yml` qui passe la validation zod sans erreur.
3. **A3** — `arc setup` lancé sur un VPS Ubuntu 24.04 vierge mène à une stack fonctionnelle en moins de **15 minutes**, sans intervention manuelle entre les questions.
4. **A4** — Re-lancer `arc setup` sur une machine déjà setupée est **idempotent** (pas de duplication, pas de crash).
5. **A5** — `arc deploy` (sans flag) régénère les composes maison + `.env` et applique les changements via Coolify.
6. **A6** — `arc status` affiche correctement `Running` pour tous les services prévus (cohérence Docker ↔ état attendu).
7. **A7** — `arc logs <service>` stream les logs en temps réel.
8. **A8** — `arc backup` produit un dump SQL valide + tar.gz volumes nommés dans `~/backups/`.
9. **A9** — `arc restore <backup-id>` applique le backup sur une DB de test vide (checksum identique).
10. **A10** — `arc project add <name>` provisionne le projet via Coolify API + crée la database Postgres associée.
11. **A11** — `arc destroy` (avec confirmation) désinstalle proprement Coolify + composes maison ; **les volumes Docker sont conservés** (data préservée).
12. **A12** — `npm install -g @euglowlabs/arc-cli` ET le single-binary issu de `bun build --compile` exposent tous les deux la même surface de commandes (mêmes outputs).

### B. Stack déployée (10 critères)

13. **B1** — Coolify accessible sur `https://coolify.<domain>` avec login admin créé par `arc setup`.
14. **B2** — Le bundle `local-ai-packaged` (Ollama + Supabase + n8n + Open WebUI + Qdrant + Neo4j + Flowise + Langfuse + SearXNG + Caddy) est déployé et tous les services répondent sur leurs ports respectifs.
15. **B3** — Les modèles Ollama déclarés dans `arc.config.yml` (par défaut `mistral:7b`) sont pré-pullés et listés via `curl http://ollama:11434/api/tags`.
16. **B4** — Sandbox isolée : `docker exec arc-code-executor sh -c "ping -c1 8.8.8.8"` **échoue** (pas d'internet) ET `wget -qO- http://ollama:11434` **échoue** (pas d'accès cross-network) ET `echo > /etc/hostname` **échoue** (FS read-only).
17. **B5** — OpenClaw + DeepAgents tournent sur `ai_net`, DeepAgents joint aussi `sandbox_net` (point de jonction documenté ADR-0008).
18. **B6** — Uptime Kuma accessible sur `https://status.<domain>` et monitor au moins les 5 services critiques (Coolify, Postgres, Ollama, Dashboard, ARC Agent) avec health check < 60s.
19. **B7** — Le cron de backup tourne quotidiennement à 02h00 (vérifiable dans `/var/log/cron`) ; `pg_dumpall` produit un fichier `db_<stamp>.sql` valide ; upload R2 via `rclone` réussit si `backups.remote.bucket` est configuré.
20. **B8** — DNS Cloudflare : record A wildcard `*.<domain>` pointe sur l'IP publique du VPS (créé via Cloudflare API par `arc setup`).
21. **B9** — SSL Let's Encrypt actif sur **tous** les sous-domaines (`coolify`, `supabase`, `chat`, `n8n`, `flowise`, `langfuse`, `status`, `openclaw`, `agents`, `dashboard`, `<projects>`). `curl -I https://<sous-domaine>` retourne 200 avec un certificat valide non auto-signé.
22. **B10** — Hardening VPS effectif : `ufw status` montre uniquement 22+80+443 ouverts, `fail2ban-client status` montre les jails `sshd` actifs, `sshd_config` interdit `PasswordAuthentication`.

### C. Migration (1 critère — capacité)

23. **C1** — **Capacité de migration testée** : un utilisateur (l'auteur ou un tiers) peut migrer un projet existant (Next.js + Postgres) depuis un hébergement source vers ARC en suivant `docs/migration-guide.md` (DOC-001), **en moins de 30 minutes**, **sans aide externe**. Vérifié au moins une fois à blanc avec un projet de test (pas un projet réel — la migration des projets réels = acte d'utilisation post-livraison).

### D. Tests (2 critères)

24. **D1** — Suite de tests E2E (E2E-001) sur **VM jetable** : provisionne une VM Ubuntu, exécute `install.sh` + `arc setup`, exécute le test pack des 22 critères automatisables (A1-A12, B1-B10 hors backups remote), retourne exit 0. Tournée en CI nightly.
25. **D2** — Couverture **tests unitaires ≥ 70%** sur la logique métier (Vitest pour TS — arc-cli + arc-shared ; `go test` pour arc-agent).

## Conséquences

### Bénéfices

+ **Critère de sortie de Chantier 1 sans ambiguïté.** Soit les 25 cases sont cochées, soit elles ne le sont pas.
+ **Séparation claire produit livré ≠ utilisation du produit par l'auteur.** Vercel ne livre pas en migrant les sites de ses clients ; ARC ne se livre pas en migrant les projets de Johann.
+ **Toutes les pièces critiques de la spec infra sont représentées** : install, hardening, isolation sandbox, IA, Coolify, backup/restore, observabilité, doc utilisateur.
+ **Dérivable de la spec infra** — pas une création arbitraire. Trace explicite vers les sections de `docs/01-spec-infra.md`.
+ **Test scripts prêts à écrire.** Les 22 critères A et B sont automatisables comme commandes shell ou tests E2E. Tâche **E2E-001** (Phase 1.5) implémentera la suite.

### Conséquences négatives

- **Aucune.** Ces critères sont les minimums attendus.

### Si un critère doit être amendé

Pendant Phase 3 ou Phase 4, si un critère se révèle impraticable (ex: limitation upstream), on **ne supprime jamais** un critère :

1. On crée **ADR-0011-bis** explicite (`0011-bis-amendment-XXX.md`) qui documente l'amendement, sa justification, et son impact sur le critère #1 d'ADR-0013.
2. L'amendement reste **subordonné** à l'ADR-0011 et garde la même numérotation des 25 critères.

## Plan opérationnel

- **Phase 1.5 / E2E-001** : un script de test couvre les critères A1-A12 + B1-B10 (~22 critères automatisables).
- **Phase 3 / DASH-013** : Tests Playwright couvrent les critères Dashboard (intégrés dans D1).
- **Phase 4 (avant fin Chantier 1)** : `VALIDATE-001` à `VALIDATE-007` valident les critères infra (B1-B10) **à vide**, sur un VPS dédié.

## Alternatives rejetées

- **Critères flous (NPS > 50, "facile à utiliser")** : non vérifiables, dérive garantie.
- **Inclure les migrations des 4 projets de l'auteur comme critères** : confondu produit et utilisation. Vercel ne livre pas en migrant les sites de ses clients.
- **30 critères incluant "arc migrate" et "Cloudflare Tunnel local"** : invalidés par ADR-0012.
- **Différer les critères "à voir en cours de Phase 3"** : refusé par l'auteur (*"REFUS de différer"*).
