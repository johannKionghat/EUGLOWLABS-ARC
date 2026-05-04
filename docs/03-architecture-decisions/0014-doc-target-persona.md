# ADR-0014 : Persona cible de la documentation utilisateur

## Statut
Accepté
Date : 2026-05-04

## Contexte

EuglowLabs ARC produit deux familles de documents destinés à l'utilisateur final :

1. **Documentation produit** (`docs/migration-guide.md`, `docs/install-without-public-ip.md`, futurs `docs/getting-started.md`, `docs/operating.md`).
2. **Référence CLI / API** (générée à partir du code et conservée brève).

La rédaction initiale de DOC-001 (sous-tâches 1 → 5) a, **par défaut implicite**, ciblé un senior DevOps : familier avec `pg_dump`, `rclone`, MinIO, JWT internals, swap Linux, OOM killer, networks Docker en mode `internal`, Cloudflare proxy modes, PgBouncer, édition manuelle de `docker-compose.yml`, etc. Ce profil — appelons-le **persona A** — n'est pas le marché cible d'ARC.

Le marché cible réel d'EuglowLabs ARC est le **solo founder technique / dev fullstack indie** : il a déjà livré un projet sur Vercel, sait écrire un `pg_dump` mais pas optimiser une mémoire Postgres, configure un repo GitHub mais n'a jamais édité un `iptables`. Sans cadrage explicite du persona, la documentation produite trahit le marché cible — la barrière à l'usage devient prohibitive et le critère **C1** d'[ADR-0011](./0011-end-to-end-install-acceptance.md) ("migrer un projet en moins de 30 min sans aide externe") devient inatteignable pour ce profil.

L'auteur acte donc explicitement le persona avant de continuer la rédaction et avant tout audit rétroactif des sections déjà écrites.

## Décision

### Persona principal — "Solo founder technique / dev fullstack indie"

C'est le persona **B**. Toute documentation produite par ARC en Chantier 1 le cible en priorité.

**Maîtrise présumée** :

- Next.js, Vercel (a déjà déployé), Supabase managé (a déjà créé un projet)
- Git, GitHub, gestion d'un repo privé
- SSH, `scp`, basics ligne de commande Linux (cd, ls, grep, cat)
- Docker basique : sait lancer `docker run` ou `docker compose up`, comprend qu'un container est un processus isolé
- Postgres basique : sait que c'est une DB SQL, sait écrire un `SELECT`, sait qu'il existe des migrations

**Maîtrise NON présumée** (à expliquer ou contourner dans la doc) :

- Docker avancé : volumes nommés, labels, networks, bind mounts, mode `internal: true`, `mem_limit`
- Administration Postgres : rôles, ACLs, `pg_stat_activity`, `max_connections`, replication, vacuum
- Outils ops : `rclone`, MinIO, S3 internals
- JWT internals : signing, rotations, asymmetric crypto
- Hardening : configuration UFW, fail2ban, SSH no-password
- Linux internals : swap, OOM killer, `dmesg`, `fallocate`, systemd
- Cloudflare modes : proxy (orange) vs DNS-only (gris), CNAME flattening, rules
- PgBouncer, pooling de connexions
- Édition manuelle de `docker-compose.yml`

### Persona secondaire — "Senior DevOps / SRE" (persona A)

Pas le marché principal mais reste un public valide (early adopters, contributeurs OSS, équipes plus grandes qui adoptent ARC pour un side project). On ne l'oublie pas.

**Mécanisme** : encadrés "**TL;DR pour devs avancés**" en début de section longue, listant les commandes clés en 5–10 lignes. Le persona A peut zapper la pédagogie ; le persona B la lit en entier.

### Persona explicitement exclu — "No-code / non-technique" (persona D)

ARC nécessite SSH + CLI + un VPS. Toute personne incapable d'ouvrir un terminal SSH n'est **pas** une cible. Ne pas chercher à la rendre cible.

### Critère C1 d'ADR-0011 ajusté

L'ancien libellé "30 min sans aide externe" présumait persona A. Avec persona B, le critère devient :

> **C1 (révisé)** — Capacité de migration testée : un solo founder technique (persona B) peut migrer un projet existant (Next.js + Postgres) depuis un hébergement source vers ARC en suivant `docs/migration-guide.md`, **en moins de 60 minutes**, **sans aide externe**.

Cette révision est tracée ici et ne crée pas un ADR-0011-bis : ADR-0014 supersede explicitement le seuil "30 min" tout en maintenant le critère lui-même. La numérotation des 25 critères d'ADR-0011 reste inchangée.

### Style attendu pour la doc

Tout document utilisateur doit suivre cette structure par étape ou cas d'usage :

1. **POURQUOI cette étape** — 1–2 phrases qui expliquent l'intention avant la commande.
2. **COMMENT** — la commande copiable, avec placeholders `<CHEVRONS>` (cf. `docs/migration-guide.md` §"Conventions de notation").
3. **DÉFINITION COURTE** des termes techniques en passant — entre parenthèses ou note d'une ligne (ex : *rclone = outil de copie de fichiers vers stockage cloud, équivalent de scp pour S3/R2*).
4. **ERREURS COURANTES** que le persona B est susceptible de faire — anticipées en bloc dédié.
5. **POUR ALLER PLUS LOIN** — lien externe (Postgres docs, Docker docs, MDN, RFC) pour les concepts profonds qui ne tiennent pas en 2 phrases.

Encadrés disponibles :

- **TL;DR pour devs avancés** : début de section, version condensée pour persona A.
- **⚠️ Erreur courante** : avertissement sur un piège connu.
- **🔍 Pourquoi** : justification d'un choix technique non évident.
- **📚 Pour aller plus loin** : lien externe.

### Périmètre d'application

S'applique à toute documentation produit nouvelle ou modifiée à partir de la sortie de cet ADR, **y compris l'audit rétroactif** des sections de `docs/migration-guide.md` rédigées avant cet ADR. La sous-tâche 5 de DOC-001 marque la frontière : §1.a, §1.b, §2, §3, §5, §6 doivent être passées au crible et alignées sur le persona B avant validation finale de DOC-001.

Ne s'applique **pas** aux ADRs eux-mêmes (lecteur cible = futurs contributeurs / auteur) ni à la référence CLI auto-générée.

## Conséquences

### Bénéfices

+ **Doc utile pour le marché cible réel.** Le critère C1 redevient atteignable.
+ **Adoption facilitée.** Un solo founder qui ouvre `docs/migration-guide.md` n'est pas pris de court par `pg_stat_activity` à la 5e ligne.
+ **Cadre de rédaction explicite.** Toute future tâche DOC-* peut s'y référer.
+ **Décision documentée et tracée.** Pas de dérive silencieuse de niveau de rédaction entre auteurs / agents.

### Conséquences négatives

- **Doc plus longue (~30 % de plus en lignes).** Atténué par les encadrés TL;DR pour le persona A.
- **Effort de rédaction accru.** Acceptable : la doc est lue 100× plus qu'elle n'est écrite.
- **Risque de devenir condescendant si appliqué naïvement.** Mitigation : la pédagogie reste optionnelle (TL;DR), le ton reste celui d'un pair, pas d'un manuel scolaire.

### Conséquence opérationnelle immédiate sur DOC-001

Une **sous-tâche d'audit** s'insère entre l'écriture des sections (sous-tâches 1 → 5) et la création de `install-without-public-ip.md` (sous-tâche 6) :

- Audit section par section de `docs/migration-guide.md` (§1.a, §1.b, §2, §3, §5, §6) au regard du persona B.
- Production d'un diff par section, validé un par un par l'auteur.
- Application des modifications après validation.

Cela renumérote le plan d'implémentation de DOC-001 — mise à jour de `tasks/current.md` simultanée à cet ADR.

## Alternatives rejetées

- **Cibler persona A (senior DevOps).** Trahit le marché cible, rend le produit inaccessible aux solo founders.
- **Cibler persona D (no-code).** ARC exige SSH + CLI ; persona D ne peut techniquement pas l'utiliser. Ce serait écrire pour un public qui ne nous lira pas.
- **Doc dual (deux niveaux séparés et complets, A et B).** Effort doublé, maintenance doublée, risque de divergence entre niveaux. Encadrés TL;DR couvrent le besoin sans dédoubler le doc.
- **Laisser le niveau implicite.** Donne ce qu'on a déjà : doc niveau A par défaut, persona B perdu, C1 inatteignable.

## Notes de mise en œuvre

- Référencer cet ADR dans toute nouvelle tâche DOC-* du backlog.
- Référencer dans `docs/04-conventions/` (à créer ultérieurement : `docs/04-conventions/doc-style.md`).
- Lien réciproque depuis `docs/migration-guide.md` (intro) vers cet ADR pour expliquer le ton choisi.

## Amendement — 2026-05-04

Le critère C1 d'ADR-0011 ("60 minutes pour un dev fullstack indie") cible le parcours principal §1.a (Next.js + Postgres simple) : install ARC + migration projet ≈ 50 min, conforme.

Les migrations spécifiques peuvent dépasser ce seuil de manière intrinsèque :

- **§1.b Supabase complet** (auth, storage, RLS, Edge Functions, JWT) : ~70 min total. La complexité est dans la nature du sujet, pas dans la pédagogie de la doc.
- **Vercel KV/Blob** (cas non couvert actuellement) : à estimer si cas réel remonté.

Cette nuance est attendue et n'invalide pas C1. La doc explicite ses estimations par section pour que le persona B planifie correctement.
