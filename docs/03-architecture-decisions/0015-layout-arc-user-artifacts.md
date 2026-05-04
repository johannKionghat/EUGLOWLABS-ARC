# ADR-0015 : Layout des artefacts utilisateur ARC sous `~/.arc/`

## Statut
Accepté
Date : 2026-05-04

## Contexte

La spec infrastructure v2.0 §5.3 mentionne `/etc/arc/` comme emplacement des artefacts générés par le CLI (composes maison, état runtime, etc.). Cette mention précède [ADR-0012](./0012-single-machine-install.md) qui acte le modèle single-machine — ARC tourne sur la machine cible elle-même, lancé par un utilisateur (potentiellement non-root sur Raspberry Pi, WSL2, NAS).

L'utilisation de `/etc/arc/` impose des permissions root permanentes pour toute opération `arc *`, ce qui :
- est incompatible avec un usage Raspberry Pi en user `pi` ou WSL2 en user standard
- complique l'installation par `curl install.sh | sh` sans `sudo`
- introduit du friction inutile pour des artefacts qui n'ont pas vocation à être lus / écrits par un autre user que celui qui pilote ARC
- expose l'utilisateur à une perte d'artefacts si la machine multi-user (improbable en cible ARC mais pas exclu)

Le hardening système (UFW, fail2ban, `/etc/wsl.conf`, install Docker, configuration `/usr/local/bin/arc`) reste évidemment du ressort de root, **mais il est exécuté ponctuellement par Ansible pendant `arc setup`**, pas par chaque commande `arc *` ultérieure.

INSTALL-001a doit choisir un emplacement pour les composes générés (`docker-compose.prod.yml`, `docker-compose.sandbox.yml`, `docker-compose.agents.yml`) avant de coder. Cette décision est structurante pour toutes les commandes `arc` ultérieures (`status`, `restart`, `backup`…), donc on l'acte explicitement.

## Décision

Tous les **artefacts utilisateur** générés et lus par le CLI `arc` vivent sous **`~/.arc/`** (HOME de l'utilisateur qui exécute `arc *`), avec le layout suivant :

```
~/.arc/
├── arc.config.yml          # Config principale validée zod (déjà existant — Phase 1)
├── state.json              # État runtime : projets, derniers déploiements (déjà existant — CLI-014)
├── compose/                # Composes générés par arc setup [NOUVEAU INSTALL-001a/b]
│   ├── docker-compose.prod.yml
│   ├── docker-compose.sandbox.yml
│   └── docker-compose.agents.yml
├── credentials/            # Secrets locaux générés (chmod 700) [NOUVEAU]
│   ├── agent-token         # Token statique ARC Agent (Phase 2)
│   └── *.json              # Tokens cloudflared, R2, etc.
└── backups/                # Backups locaux avant upload R2 (déjà existant — CLI-018)
    └── <BACKUP_ID>/
```

**Permissions** :
- `~/.arc/` : `0755` (lisible par l'user, exécutable par tous pour traverser).
- `~/.arc/credentials/` : `0700` (lecture-écriture-exécution par l'user uniquement).
- `~/.arc/credentials/*` : `0600`.
- Tout le reste : par défaut `0644` / `0755`.

**Permissions root nécessaires** restent **strictement scopées au hardening Ansible** :
- Installation Docker (`/usr/bin/docker`, `/etc/docker/daemon.json`).
- UFW + fail2ban (`/etc/ufw/`, `/etc/fail2ban/`).
- Pose du binaire `arc` dans `/usr/local/bin/` par `install.sh`.
- Service systemd `cloudflared` (cf. `docs/install-without-public-ip.md`).
- Modification `/etc/wsl.conf` si applicable.

Aucune commande `arc *` post-`setup` ne doit demander `sudo`. Si une opération l'exige, c'est qu'elle viole cet ADR.

**`/etc/arc/` est explicitement abandonné** comme emplacement d'artefacts utilisateur. La mention dans la spec infra v2.0 §5.3 est superseded par cet ADR.

## Conséquences

### Bénéfices
+ **Compatible Raspberry Pi / WSL2 / NAS en user non-root** sans friction.
+ **`curl install.sh | sh` sans sudo** possible (le sudo est demandé uniquement par le `arc setup` lui-même quand il appelle Ansible — et seulement pour les sous-rôles hardening).
+ **Multi-user sur la même machine** théoriquement possible (un user A, un user B = deux instances ARC indépendantes via `~/.arc/` distincts), même si ce n'est pas un cas d'usage cible.
+ **Backups + secrets restent dans le HOME** de l'user qui pilote — convention standard Linux.
+ **Cohérence avec `~/.arc/arc.config.yml`** déjà acté implicitement en Phase 1 (CLI-014, CLI-015).

### Compromis acceptés
- **Disque dur saturé sur `/home`** : si l'user a une partition `/home` petite, les backups peuvent saturer. Mitigation : option `backups.local.dir` dans `arc.config.yml` pour relocaliser. À implémenter dans une tâche future si la demande remonte.
- **Composes lus par les commandes `docker compose -f ...`** depuis `~/.arc/compose/` : suppose que l'user qui exécute `arc *` a Docker accessible. Cas standard, `arc setup` ajoute l'user au groupe `docker` lors du hardening.

### Conséquence opérationnelle
Toute commande `arc *` qui génère ou lit un artefact passe par une fonction `arcUserDir()` centralisée (à créer dans `arc-shared` ou `arc-cli/src/paths.ts`) qui résout `~/.arc/...`. Pas de chemins en dur ailleurs dans le code.

## Alternatives rejetées

- **`/etc/arc/`** (spec infra v2.0 §5.3) : exige root permanent, incompatible avec single-machine cible RPi/WSL2.
- **`/var/lib/arc/`** : convention Linux service-system pour data persistante, mais demande root pour création initiale et écriture. Même problème que `/etc/arc/`.
- **`/opt/arc/`** : pareil que `/var/lib/arc/`.
- **`$XDG_CONFIG_HOME/arc/` (par défaut `~/.config/arc/`) + `$XDG_DATA_HOME/arc/`** : standard XDG, mais sépare config et data ce qui complique les exports / backups de `~/.arc/` complet. Convention plus pure mais effort > bénéfice pour un produit single-user. À reconsidérer si XDG devient un critère client.
- **`./arc/` dans le repo projet** : confusion possible avec le repo applicatif de l'user, et empêche l'usage d'une seule instance ARC pour plusieurs projets.

## Notes de mise en œuvre

- Helper `arcUserDir(): string` à créer dans `packages/arc-cli/src/paths.ts` (ou `packages/arc-shared`).
- Toutes les références hardcodées à `~/.arc/...` ou `/etc/arc/...` doivent passer par ce helper.
- INSTALL-001a doit créer `~/.arc/compose/` (mkdir -p, mode 0755) avant d'y écrire les composes.
- INSTALL-001b doit créer `~/.arc/credentials/` (mkdir -p, mode 0700) si la sous-tâche y dépose des secrets — sinon laisser à Phase 2 (AGENT-003 token statique).
- Audit `docs/refactor-0012-completion.md` ne mentionne pas `/etc/arc/` côté code applicatif post-REFACTOR — bonne nouvelle, pas de migration de chemins existants nécessaire.
