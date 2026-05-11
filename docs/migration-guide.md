# Guide de migration — EuglowLabs ARC

> **Objectif** : permettre à un utilisateur de migrer un projet existant (Vercel, Supabase managé, autre VPS) vers une instance EuglowLabs ARC en moins de **30 minutes**, en suivant uniquement ce guide.
>
> Ce document est l'**unique artefact de migration côté produit**. Il mitige les compromis P2 et P3 actés dans [ADR-0012](./03-architecture-decisions/0012-single-machine-install.md) et couvre le critère **C1** d'[ADR-0011](./03-architecture-decisions/0011-end-to-end-install-acceptance.md).

## À qui s'adresse ce guide

Vous êtes au bon endroit si :

- Vous avez **déjà une instance ARC installée et fonctionnelle** sur un VPS (cf. `arc setup`).
- Votre VPS dispose d'une **IP publique** (cas standard : OVH, Hetzner, Scaleway, AWS, DigitalOcean…).
- Vous voulez **déplacer un projet existant** vers cette instance, ou bien **déplacer / dupliquer une instance ARC** elle-même.

> 🏠 **Vous installez ARC à la maison (Raspberry Pi, machine WSL2, réseau local sans IP publique) ?**
> Ce guide n'est pas pour vous. Lisez d'abord [`install-without-public-ip.md`](./install-without-public-ip.md) pour configurer un tunnel Cloudflare manuel, puis revenez ici pour migrer vos projets.

## Prérequis

Avant de commencer, vérifiez :

```bash
# Sur l'instance ARC cible
arc status
```

La commande doit retourner `Running` pour Coolify, Postgres (Supabase), et l'ARC Agent. Si ce n'est pas le cas, finissez d'abord votre installation avant de migrer quoi que ce soit.

Vous aurez aussi besoin :

- D'un accès SSH root (ou sudo) à l'instance ARC cible.
- De vos credentials d'accès à la source (dump SQL, clé API Vercel/Supabase managé, accès SSH au serveur source…).
- D'un domaine pointant sur l'IP publique de l'instance ARC (record A wildcard `*.<DOMAIN>`).

## Sommaire

- [§1 — Migrer une app existante vers ARC](#1--migrer-une-app-existante-vers-arc)
  - [§1.a — Next.js + Postgres simple](#1a--nextjs--postgres-simple)
  - [§1.b — App utilisant Supabase](#1b--app-utilisant-supabase)
- [§2 — Déplacer un projet d'une instance ARC à une autre](#2--déplacer-un-projet-dune-instance-arc-à-une-autre)
- [§3 — Dupliquer une instance ARC en staging](#3--dupliquer-une-instance-arc-en-staging)
- [§5 — Rollback d'un déploiement cassé](#5--rollback-dun-déploiement-cassé)
- [§6 — Troubleshooting (5 cas fréquents)](#6--troubleshooting-5-cas-fréquents)

> **Pourquoi pas de §4 ?** La section 4 (« Installer ARC sans IP publique ») a été extraite vers [`install-without-public-ip.md`](./install-without-public-ip.md) — public et moment d'utilisation différents.
>
> **Pourquoi pas de §1.c (Vercel KV + Blob) ?** Cette section sera ajoutée le jour où un cas réel de migration nous est remonté (issue GitHub). Nous préférons de la doc testée à de la doc imaginée.

## Conventions de notation

Tout au long de ce guide, les blocs de commandes sont préfixés par un commentaire indiquant **où** la commande s'exécute :

```bash
# Sur la machine source (l'ancien hébergement)
echo "exécutée sur le serveur source"
```

```bash
# Sur l'instance ARC cible
echo "exécutée sur le VPS où ARC tourne"
```

```bash
# Sur votre poste local
echo "exécutée sur votre laptop"
```

Les **valeurs variables** apparaissent entre `<CHEVRONS_MAJUSCULES>`. Vous devez les remplacer par vos vraies valeurs. Exemples :

- `<VPS_IP>` → l'IP publique de votre instance ARC (ex : `91.107.220.45`)
- `<DOMAIN>` → votre domaine racine (ex : `euglowlabs.com`)
- `<PROJECT_NAME>` → le nom du projet à migrer (ex : `infinix-ui`)
- `<BACKUP_ID>` → l'identifiant d'un backup (ex : `2026-05-04-0200`)

Toutes les autres commandes sont **copiables telles quelles**, sans modification.

---

## §1 — Migrer une app existante vers ARC

> *Cette section sera remplie en sous-tâche 2 et 3.*

### §1.a — Next.js + Postgres simple

**Cas d'usage cible** : votre app Next.js tourne sur Vercel, votre Postgres tourne en managé (Neon, Railway, Supabase Postgres seul, ou un autre VPS). Vous voulez tout rapatrier sur votre instance ARC.

**Estimation** : ~20 min de manipulation, hors propagation DNS (qui peut prendre jusqu'à 24 h selon votre TTL).

> **TL;DR pour devs avancés** :
> 1. `vercel env pull` → garder les API keys, jeter `DATABASE_URL`.
> 2. `arc project add <PROJECT_NAME>` sur ARC.
> 3. `pg_dump --no-owner --no-acl -Fc` côté source → `scp` → `docker exec ... pg_restore` côté ARC.
> 4. Connecter le repo + envvars dans Coolify (UI), `arc project deploy`.
> 5. Smoke test, basculer le DNS, retirer Vercel après 24 h.

**Pré-flight check** : avant de toucher à Vercel, vérifiez sur l'instance ARC cible :

```bash
# Sur l'instance ARC cible
arc status
arc project list
```

#### Étape 1 — Récupérer les env vars Vercel

Vercel ne migre **rien** automatiquement. Vous devez exporter manuellement les variables d'environnement avant de couper.

```bash
# Sur votre poste local
npx vercel link
npx vercel env pull .env.production.local --environment=production
```

Ouvrez `.env.production.local` dans un éditeur. Listez les variables que vous allez réutiliser sur ARC. Mettez de côté :

- `DATABASE_URL` (sera réécrite vers Postgres ARC à l'étape 4)
- Toutes les clés API tierces (Stripe, OpenAI, Resend…) → réutilisables telles quelles
- Tout `NEXT_PUBLIC_VERCEL_*` → à supprimer ou remplacer par votre `<DOMAIN>` cible.

  🔍 **Pourquoi** : ces variables sont injectées par Vercel à la build (URL de preview, branche, commit SHA). Sur ARC, elles ne sont pas générées — soit votre code les utilise et il faut les remplacer par vos propres valeurs, soit il ne les utilise pas vraiment et autant les supprimer.

> ⚠️ **Ne committez jamais `.env.production.local` dans Git.** Vérifiez que `.env.production.local` est bien dans votre `.gitignore` avant de continuer.

#### Étape 2 — Créer le projet sur l'instance ARC

```bash
# Sur l'instance ARC cible
arc project add <PROJECT_NAME>
```

La commande provisionne via l'API Coolify :

- Une application vide nommée `<PROJECT_NAME>`
- Une base Postgres dédiée `<PROJECT_NAME>_db`
- Un sous-domaine par défaut `<PROJECT_NAME>.<DOMAIN>` (Let's Encrypt automatique)

À la fin, `arc project add` affiche les credentials Postgres. **Notez-les** — vous en aurez besoin à l'étape 4 :

```
Postgres URL : postgresql://<DB_USER>:<DB_PASS>@postgres:5432/<PROJECT_NAME>_db
```

#### Étape 3 — Dumper la base Postgres source

Connectez-vous à votre Postgres source et faites un dump complet schéma + données.

**Cas standard (base < 1 Go)** :

```bash
# Sur votre poste local (ou sur la machine source si pg_dump y est dispo)
pg_dump \
  --no-owner \
  --no-acl \
  --format=custom \
  --file=<PROJECT_NAME>.dump \
  "<SOURCE_DATABASE_URL>"
```

**Cas base volumineuse (> 1 Go)** : ajoutez la compression et le parallélisme.

```bash
# Sur votre poste local
pg_dump \
  --no-owner \
  --no-acl \
  --format=directory \
  --jobs=4 \
  --compress=9 \
  --file=<PROJECT_NAME>.dumpdir \
  "<SOURCE_DATABASE_URL>"

tar -czf <PROJECT_NAME>.dumpdir.tar.gz <PROJECT_NAME>.dumpdir
```

Notes :

- `--no-owner` et `--no-acl` évitent les `ERROR: role "..." does not exist` à la restauration.

  *ACL = Access Control List = la liste des permissions Postgres par utilisateur sur chaque table. Sur Neon ou Supabase managé, vos tables appartiennent à des rôles techniques (`neon_owner`, `supabase_admin`…) qui n'existent pas côté ARC. En les omettant, Postgres recréera les tables sous le compte par défaut sans bloquer.*
- `--format=directory + --jobs=N` parallélise le dump sur N processus simultanés (un par table). Sur une base de plusieurs Go, divise typiquement le temps par 3 à 4.
- `--jobs=4` : 4 est un compromis raisonnable pour la plupart des VPS modernes (4 cœurs+). Sur un petit VPS 2 vCPU, mettez `--jobs=2`. Sur un gros VPS 16 vCPU, `--jobs=8`.
- `--compress=9` : niveau de compression gzip max. Plus lent mais réduit le volume à transférer (utile sur connexion lente).
- Si votre base dépasse 10 Go, envisagez de stopper les écritures côté source pendant le dump.

  *Pourquoi : `pg_dump` est cohérent à un instant T (snapshot transactionnel) mais sur une base très active, des secondes voire minutes peuvent s'écouler entre la première et la dernière table dumpée — risque d'incohérence sur des données croisées. Concrètement :*
  - *Sur Neon : projet → Settings → "Pause project" pendant le dump.*
  - *Sur Supabase managé : pas d'équivalent direct, mais vous pouvez révoquer temporairement les permissions d'écriture côté backend, ou simplement faire le dump à 3 h du matin quand le trafic est minimal.*
  - *Sur un Postgres auto-hébergé : `ALTER DATABASE <db> SET default_transaction_read_only = on;` (à révoquer après).*

#### Étape 4 — Transférer le dump et le restaurer

D'abord, préparez un dossier dédié sur l'instance ARC (`/tmp/` est lisible par tous, on l'évite) :

```bash
# Sur l'instance ARC cible — préparer le dossier de migration
mkdir -p /root/migration && chmod 700 /root/migration
```

Ensuite, identifiez le nom exact du container Postgres. Il dépend de la version de `local-ai-packaged` déployée et peut changer entre versions. **Si vous avez déjà des projets Coolify, plusieurs containers Postgres coexistent** — il faut isoler celui du bundle `local-ai-packaged`, pas ceux des apps utilisateur :

```bash
# Sur l'instance ARC cible
# Filtre sur le container Postgres du bundle local-ai-packaged (pas les Postgres des apps Coolify)
docker ps --filter "label=com.docker.compose.project=local-ai-packaged" --format '{{.Names}}'

# À défaut, si le label ci-dessus ne correspond pas à votre stack :
docker ps --format 'table {{.Names}}\t{{.Image}}' | grep -i supabase
```

*Cette commande liste les containers qui portent le label `com.docker.compose.project=local-ai-packaged` — un label est une étiquette posée par Docker Compose sur ses containers pour les regrouper. ARC utilise ce label pour distinguer le Postgres de la stack système (celui qu'on cherche) des Postgres lancés par Coolify pour les projets utilisateur (qu'on ne veut PAS toucher).*

⚠️ **Erreur courante** : si la sortie est vide, le label peut différer dans votre version. Le fallback `docker ps | grep -i supabase` reste fiable.

Utilisez la valeur affichée comme `<POSTGRES_CONTAINER>` dans les commandes suivantes.

Transférez le dump :

```bash
# Sur votre poste local
scp <PROJECT_NAME>.dump root@<VPS_IP>:/root/migration/
# Ou pour le cas volumineux :
scp <PROJECT_NAME>.dumpdir.tar.gz root@<VPS_IP>:/root/migration/
```

Restauration côté ARC. Le container Postgres écoute en interne sur le réseau Docker ; on passe par `docker exec` :

```bash
# Sur l'instance ARC cible (cas standard < 1 Go)
docker exec -i <POSTGRES_CONTAINER> pg_restore \
  --no-owner \
  --no-acl \
  --dbname=<PROJECT_NAME>_db \
  --username=<DB_USER> \
  < /root/migration/<PROJECT_NAME>.dump
```

```bash
# Sur l'instance ARC cible (cas volumineux > 1 Go)
cd /root/migration
tar -xzf <PROJECT_NAME>.dumpdir.tar.gz
docker cp <PROJECT_NAME>.dumpdir <POSTGRES_CONTAINER>:/tmp/
docker exec <POSTGRES_CONTAINER> pg_restore \
  --no-owner \
  --no-acl \
  --jobs=4 \
  --dbname=<PROJECT_NAME>_db \
  --username=<DB_USER> \
  /tmp/<PROJECT_NAME>.dumpdir
```

*`docker cp` copie un fichier ou dossier entre le système hôte (le VPS) et un container. Ici on déplace le dossier de dump du VPS vers `/tmp/` à l'intérieur du container Postgres, parce que `pg_restore` en mode `--format=directory` doit lire le dossier depuis l'intérieur du container.*

Vérifiez la restauration :

```bash
# Sur l'instance ARC cible
docker exec -it <POSTGRES_CONTAINER> psql \
  --username=<DB_USER> \
  --dbname=<PROJECT_NAME>_db \
  --command="\dt"
```

*`\dt` est la commande `psql` pour lister les tables (équivalent de `SHOW TABLES;` en MySQL). Vous devez voir vos tables applicatives. Si la sortie indique `Did not find any relations.`, la restauration n'a rien chargé.*

Si la sortie est vide, vérifiez les logs `docker logs <POSTGRES_CONTAINER> --tail=200`.

#### Étape 5 — Connecter le repo Git et configurer les env vars

> ℹ️ **Note CLI vs UI** : à ce jour le CLI `arc` ne couvre pas la connexion repo Git ni l'injection d'env vars projet (cf. surface CLI `arc project add|list|deploy` uniquement). Cette étape passe donc par l'UI Coolify. Des commandes CLI dédiées (`arc project set-repo`, `arc project set-env`) seront ajoutées dans des tâches CLI ultérieures — d'ici là, suivez la procédure UI ci-dessous.

Ouvrez Coolify dans votre navigateur :

```
https://coolify.<DOMAIN>
```

Dans le projet `<PROJECT_NAME>` :

1. **Source** → ajoutez votre repo Git :
   - **GitHub App** : recommandé si votre repo est sur GitHub. Coolify vous redirige vers GitHub pour autoriser l'accès, comme Vercel le faisait.
   - **Deploy Key** : alternative, surtout si votre repo est sur GitLab, Bitbucket ou auto-hébergé. Coolify génère une clé SSH publique que vous collez dans les paramètres du repo.
2. **Build pack** → laissez sur `Nixpacks` (détecte Next.js automatiquement).

   *Nixpacks est l'équivalent open source de "Buildpacks" (Heroku) ou des builds automatiques Vercel : il analyse votre repo, détecte le framework (Next.js, Astro, SvelteKit…) et génère le Dockerfile correspondant sans configuration. Vous n'avez rien à écrire.*
3. **Environment Variables** → collez chaque ligne de votre `.env.production.local` *sauf* `DATABASE_URL`.
4. Pour `DATABASE_URL`, utilisez la valeur affichée à l'étape 2 :
   ```
   DATABASE_URL=postgresql://<DB_USER>:<DB_PASS>@postgres:5432/<PROJECT_NAME>_db
   ```
5. **Domains** → laissez `<PROJECT_NAME>.<DOMAIN>` pour le premier déploiement (le custom domain viendra à l'étape 7).

#### Étape 6 — Premier déploiement

Cliquez sur **Deploy** dans Coolify, ou :

```bash
# Sur l'instance ARC cible
arc project deploy <PROJECT_NAME>
```

Suivez les logs en temps réel :

```bash
# Sur l'instance ARC cible
arc logs <PROJECT_NAME>
```

Quand le build passe au statut `Running`, testez :

```bash
# Sur votre poste local
curl -I https://<PROJECT_NAME>.<DOMAIN>
```

Vous devez obtenir un statut `200` avec un certificat Let's Encrypt valide (la première ligne de la réponse `curl -I` ressemble à `HTTP/2 200` ou `HTTP/1.1 200 OK` selon le proxy). Si vous obtenez un `502` ou un `503`, attendez 30 s (Let's Encrypt peut mettre quelques secondes à émettre le certificat sur la première requête) puis réessayez. Si le problème persiste après 2 min, voyez §6.2 (Let's Encrypt en échec).

#### Étape 7 — Bascule du DNS

Tant que tout n'est pas vert, **ne touchez pas à Vercel.** Une fois le smoke test OK :

1. Côté votre registrar / Cloudflare DNS : remplacez l'enregistrement de votre domaine personnalisé (ex : `app.example.com`) qui pointait vers Vercel par un enregistrement A vers `<VPS_IP>` (ou CNAME vers `<PROJECT_NAME>.<DOMAIN>`).
2. Dans Coolify → projet → **Domains**, ajoutez votre domaine personnalisé. Coolify émet un certificat Let's Encrypt dédié.
3. Attendez la propagation DNS :
   ```bash
   # Sur votre poste local
   dig +short app.example.com
   ```
   Vous devez voir `<VPS_IP>` (ou la chaîne CNAME). Le TTL de votre ancien record détermine la durée — typiquement 5 min à quelques heures.

   *TTL (Time To Live) = durée pendant laquelle les résolveurs DNS du monde entier ont droit de cacher la valeur. Si votre ancien record A pointait vers Vercel avec TTL = 3600, les résolveurs continueront pendant 1 h à renvoyer l'IP Vercel même si vous avez changé. **Astuce** : 1 h avant la bascule, baissez le TTL de votre record actuel à 60 s ; après bascule + propagation, remontez-le à une valeur normale (300 s).*

   **Procédure concrète chez Cloudflare** (le cas standard) :
   1. Cloudflare dashboard → votre zone → **DNS** → **Records**.
   2. Cliquez sur le record A à modifier.
   3. Si le statut est **"Proxied"** (nuage orange), passez-le en **"DNS only"** (nuage gris) — sinon le champ TTL est figé sur "Auto".
   4. Champ **"TTL"** → choisissez **"1 minute"** (60 s).
   5. **Save**.
   6. Attendez 5–10 min que les caches DNS se rafraîchissent.
   7. Faites votre bascule (modification de l'IP).
   8. Une fois la propagation confirmée (cf. `dig +short`), remontez le TTL à **"Auto"** et remettez **"Proxied"** si vous l'aviez activé.

   Sur d'autres registrars (OVH, GoDaddy, Namecheap…) le principe est identique : trouvez le champ TTL du record concerné, baissez-le à 60 s avant bascule, remontez-le après.

#### Étape 8 — Vérification post-migration

```bash
# Sur votre poste local
curl -I https://app.example.com
curl https://app.example.com/api/health
```

Sur Coolify :

- Onglet **Logs** : aucune erreur 5xx récurrente.
- Onglet **Metrics** : la mémoire et le CPU se stabilisent.

Sur ARC :

```bash
# Sur l'instance ARC cible
arc status
```

Tous les services prévus doivent être en `Running`.

#### Étape 9 — Désactiver l'ancien déploiement Vercel et nettoyer

Une fois 24 h écoulées sans incident :

1. Dans le dashboard Vercel : projet → **Settings** → **Pause Project**, ou **Delete Project** si vous êtes certain de ne pas revenir en arrière.
2. Côté Postgres source (Neon, Railway…) : suspendez ou supprimez la base. Conservez le dump `<PROJECT_NAME>.dump` au moins 30 jours.
3. Côté ARC, supprimez le dump transféré une fois la migration validée :

```bash
# Sur l'instance ARC cible — après validation §8 (24 h)
rm -rf /root/migration/<PROJECT_NAME>.dump*
```

#### Cas de bord identifiés (hors scope strict de §1.a)

- **Next.js Image Optimization avec domaines distants** : si votre `next.config.js` liste `images.remotePatterns`, vérifiez après bascule que les images externes chargent toujours. Pas de spécificité ARC, mais oubli fréquent.
- **Cron jobs Vercel** (`vercel.json` → `crons`) : non portés automatiquement. Si votre app dépend de crons, créez-les manuellement côté ARC (Coolify supporte les scheduled tasks par projet, ou cron systemd côté VPS) — détail à documenter dans une section dédiée plus tard si la demande remonte. En attendant une procédure dédiée, le pattern recommandé est : créer un workflow n8n (déjà déployé dans la stack `ai-stack`) qui appelle l'endpoint correspondant de votre app à intervalles réguliers.
- **Edge Runtime / Edge Functions Vercel** : si une route utilise `export const runtime = 'edge'`, elle tournera en Node.js standard sur ARC. Comportement identique pour 95 % des cas, à valider pour les cas exotiques (streaming, geolocation headers).

### §1.b — App utilisant Supabase

**Cas d'usage cible** : votre app Next.js tourne sur Vercel et utilise un projet Supabase managé (`<project>.supabase.co`). Selon les fonctionnalités utilisées, vous voulez migrer vers le Supabase **self-hosted** déployé par ARC via le bundle `local-ai-packaged` (cf. [ADR-0007](./03-architecture-decisions/0007-postgres-shared-via-supabase.md)) :

- **Postgres** + **RLS policies** (toujours)
- **Auth** (`auth.users`, sessions, providers OAuth)
- **Storage** (buckets, fichiers, policies)
- **Realtime** (canaux WebSocket alimentés par la replication logique de Postgres — c'est ce qui fait marcher `supabase.channel(...).subscribe()`)
- **Edge Functions** (Deno, déployées par `supabase functions deploy`)

**Estimation** : ~35–40 min de manipulation, hors propagation DNS.

**Avant tout** : §1.b reprend la trame de §1.a (création projet ARC, restauration Postgres, deploy Coolify, bascule DNS). Lisez d'abord §1.a pour ne pas perdre de temps. Cette section couvre **uniquement les spécificités Supabase** ; pour tout le reste, référez-vous aux étapes correspondantes de §1.a.

> **TL;DR pour devs avancés** :
> 1. Inventaire : récupérer `<SOURCE_JWT_SECRET>`, `<SOURCE_ANON_KEY>`, `<SOURCE_SERVICE_ROLE_KEY>`, liste buckets, liste edge functions.
> 2. `arc project add <PROJECT_NAME>` (l'enveloppe, pas la DB cible).
> 3. `pg_dump --schema=public,auth,storage -Fc` côté source → `pg_restore` dans la base `postgres` du Supabase self-hosted.
> 4. Migrer les buckets : `supabase storage cp` (scheme `s3://`) ou `rclone` vers MinIO.
> 5. Récupérer les nouvelles `<ARC_*_KEY>` (cf. §1.b étape 6), réécrire env côté app.
> 6. Redéployer Edge Functions : `supabase functions deploy --no-verify-jwt` ou bundle REST.
> 7. Bascule DNS, reload côté clients pour invalider les JWT.

#### Étape 1 — Inventaire de votre projet Supabase managé

Listez ce que vous utilisez réellement. Une migration Supabase complète touche jusqu'à 5 sous-systèmes ; vous n'avez peut-être besoin que de 2 ou 3.

> **Version CLI Supabase requise** : `supabase --version` doit retourner **≥ 1.200.0** (sortie début 2025) pour disposer des sous-commandes `storage` stables. Les versions plus anciennes n'ont pas de sous-commande storage et nécessitent l'API REST directe.

```bash
# Sur votre poste local — vérifier ou installer la CLI Supabase
supabase --version || npm install -g supabase

# Sur votre poste local — se lier au projet managé
supabase login
supabase link --project-ref <SOURCE_PROJECT_REF>
```

*`<SOURCE_PROJECT_REF>` est l'identifiant de votre projet Supabase managé — la chaîne de 20 caractères visible dans l'URL du dashboard (`https://app.supabase.com/project/<SOURCE_PROJECT_REF>`) ou dans **Settings → General → Reference ID**.*

Récupérez les valeurs depuis le dashboard Supabase managé (`https://app.supabase.com/project/<SOURCE_PROJECT_REF>/settings`) :

- `<SOURCE_DB_URL>` → **Settings → Database → Connection string** (URI)
- `<SOURCE_JWT_SECRET>` → **Settings → API → JWT Settings → JWT secret**

  *C'est le secret avec lequel Supabase signe tous les JWT (sessions utilisateurs, tokens API). Vous n'en avez besoin que si vous voulez préserver les sessions actives à la bascule (cas avancé — voir §1.b étape 6 note "Alternative").*

- `<SOURCE_ANON_KEY>` → **Settings → API → Project API keys → `anon` `public`**

  *Clé publique, utilisable côté navigateur. Soumise aux Row Level Security (RLS) policies de votre base.*

- `<SOURCE_SERVICE_ROLE_KEY>` → **Settings → API → Project API keys → `service_role` `secret`**

  *Clé "admin", uniquement côté serveur. Bypass complet du RLS. Ne jamais l'exposer côté navigateur.*

- Liste des buckets → **Storage**
- Liste des Edge Functions → **Edge Functions**, ou `supabase functions list`

Côté ARC, récupérez également les valeurs locales (générées par `arc setup`) :

```bash
# Sur l'instance ARC cible
cat ~/.arc/arc.config.yml | grep -A 5 supabase
docker exec <SUPABASE_KONG_CONTAINER> cat /home/kong/.env 2>/dev/null || true
```

*Kong est la **gateway HTTP** placée devant tous les services Supabase (auth, storage, realtime, functions). C'est là que vivent les clés `<ARC_ANON_KEY>` et `<ARC_SERVICE_ROLE_KEY>` côté self-hosted, parce que c'est Kong qui valide les requêtes entrantes avant de les router vers le bon service interne.*

Notez `<ARC_JWT_SECRET>`, `<ARC_ANON_KEY>`, `<ARC_SERVICE_ROLE_KEY>` — ils **diffèrent** des valeurs source. Conséquence frontend : voir étape 6.

#### Étape 2 — Créer le projet sur l'instance ARC

Identique à §1.a étape 2 :

```bash
# Sur l'instance ARC cible
arc project add <PROJECT_NAME>
```

> ⚠️ Avec Supabase, on **ne crée pas une base dédiée séparée** : on importe directement dans la base Postgres partagée du Supabase self-hosted, en réutilisant les schémas système (`auth`, `storage`, `realtime`). Le `<PROJECT_NAME>_db` créé par `arc project add` reste utile pour des données strictement applicatives non gérées par Supabase, sinon il peut rester vide.
>
> *Un "schéma" Postgres est un namespace logique qui regroupe des tables. Supabase organise sa base ainsi : `auth.users` (utilisateurs), `storage.objects` (métadonnées de fichiers), `realtime.*` (publications de réplication), et `public.*` pour vos tables applicatives. On ne touche jamais aux schémas `auth` / `storage` / `realtime` au quotidien — ils sont gérés par les services Supabase.*

#### Étape 3 — Dumper Postgres avec les schémas Supabase

Contrairement à §1.a, on **inclut explicitement** les schémas `auth`, `storage`, et `public` (ainsi que vos schémas applicatifs). Les **policies RLS** sont automatiquement incluses dans `pg_dump` (elles font partie du DDL des tables).

*Pourquoi ces trois et pas plus :*
- *`public` = vos données applicatives.*
- *`auth` = vos utilisateurs (cf. §1.b cas d'usage).*
- *`storage` = les **métadonnées** des fichiers de buckets (les fichiers eux-mêmes sont migrés à l'étape 5).*
- *On exclut `realtime` (config recréée par le Supabase self-hosted), `extensions`, `pgsodium`, `vault` (gérés en propre par chaque instance).*

```bash
# Sur votre poste local
pg_dump \
  --no-owner \
  --no-acl \
  --format=custom \
  --schema=public \
  --schema=auth \
  --schema=storage \
  --file=<PROJECT_NAME>.supabase.dump \
  "<SOURCE_DB_URL>"
```

> **Préservation des user IDs** : `pg_dump` exporte `auth.users` avec leurs UUIDs originaux. À la restauration, les `id` sont conservés tels quels — toutes vos foreign keys `user_id` côté `public.*` resteront valides. **Ne créez pas de nouveaux utilisateurs côté ARC avant la restauration**, vous risqueriez des collisions.

Si votre base `auth.users` dépasse quelques milliers de comptes ou si vous avez beaucoup de fichiers indexés en `storage.objects`, ajoutez `--format=directory --jobs=4 --compress=9` comme en §1.a étape 3 cas volumineux.

#### Étape 4 — Restaurer dans Supabase self-hosted

Préparez le dossier et identifiez le container (même filtre qu'en §1.a étape 4 — attention aux Postgres multiples si vous avez déjà des projets Coolify) :

```bash
# Sur l'instance ARC cible
mkdir -p /root/migration && chmod 700 /root/migration
docker ps --filter "label=com.docker.compose.project=local-ai-packaged" --format '{{.Names}}'
```

Transférez puis restaurez. **Important** : on cible la base par défaut de Supabase self-hosted (typiquement `postgres`), pas `<PROJECT_NAME>_db`.

```bash
# Sur votre poste local
scp <PROJECT_NAME>.supabase.dump root@<VPS_IP>:/root/migration/
```

```bash
# Sur l'instance ARC cible
docker exec -i <POSTGRES_CONTAINER> pg_restore \
  --no-owner \
  --no-acl \
  --dbname=postgres \
  --username=postgres \
  --clean \
  --if-exists \
  < /root/migration/<PROJECT_NAME>.supabase.dump
```

Notes :

- `--clean --if-exists` est **recommandé pour la première restauration sur une instance ARC neuve** : il drop puis recrée chaque table, donc si un essai précédent a partiellement échoué, vous repartez propre. Si vous restaurez sur une instance ARC qui contient déjà des données productives à préserver, **retirez ces deux flags** — sinon vous écrasez le travail.
- **Bonne nouvelle** : les mots de passe restent valides après la migration. Supabase managé et Supabase self-hosted utilisent tous les deux bcrypt pour stocker les mots de passe ; vos utilisateurs pourront se reconnecter avec leur mot de passe d'origine. (Détail technique : les hashs vivent dans `auth.users.encrypted_password` et sont compatibles entre les deux.)

Vérifiez :

```bash
# Sur l'instance ARC cible
docker exec -it <POSTGRES_CONTAINER> psql \
  --username=postgres \
  --dbname=postgres \
  --command="SELECT COUNT(*) AS users FROM auth.users; SELECT COUNT(*) AS objects FROM storage.objects;"
```

Le nombre d'`users` doit correspondre à votre source. `objects` peut être à 0 si aucun fichier n'est encore copié — c'est l'étape 5.

#### Étape 5 — Migrer le storage (fichiers des buckets)

`pg_dump` a copié les **métadonnées** des fichiers (`storage.objects`), mais pas les fichiers eux-mêmes. Il faut les transférer séparément. Deux voies, choisissez selon votre volume :

**Voie A — Via la CLI `supabase storage` (volumes < 1 Go)** :

> ℹ️ La sous-commande `supabase storage` utilise le scheme **`s3://`** pour désigner les buckets distants (vérifié dans le code source CLI Supabase). Confirmez la disponibilité avec `supabase storage --help` ; cette sous-commande est portée par les versions CLI récentes (≥ 1.150 environ). Si votre CLI ne supporte pas du tout `storage`, utilisez la voie B (rclone).

```bash
# Sur votre poste local — télécharger un bucket source (depuis le projet linké)
supabase storage cp --recursive "s3://<BUCKET_NAME>/" "./<BUCKET_NAME>-export/"
```

*Le scheme `s3://` est utilisé même quand vous parlez à Supabase Storage (pas à AWS S3) — c'est juste l'identifiant de la CLI pour "bucket distant du projet linké". Le triple slash final est important : il indique "tout le bucket à la racine".*

Puis basculez la CLI sur le Supabase self-hosted et uploadez. Le self-hosted expose son endpoint Storage sur `https://supabase.<DOMAIN>/storage/v1` :

```bash
# Sur votre poste local
export SUPABASE_URL="https://supabase.<DOMAIN>"
export SUPABASE_SERVICE_ROLE_KEY="<ARC_SERVICE_ROLE_KEY>"

supabase storage cp --recursive "./<BUCKET_NAME>-export/" "s3://<BUCKET_NAME>/"
```

**Voie B — `rclone` direct vers MinIO (volumes > 1 Go, ou si la voie A ne marche pas)** :

*`rclone` est un outil ligne de commande qui copie des fichiers entre stockages locaux et cloud (S3, R2, GCS, MinIO, Backblaze, Dropbox…). Pensez `rsync` mais pour le cloud. Installé par `arc setup`.*

*MinIO est un serveur de stockage objet **compatible avec l'API S3 d'AWS**. Côté Supabase self-hosted, c'est lui qui stocke physiquement les fichiers de vos buckets — exactement comme S3 le fait pour Supabase managé. C'est pour ça qu'on utilise `rclone` en mode `provider=Minio` : on parle S3 à un MinIO.*

On télécharge d'abord le bucket source en local (voie A étape 1, ou via API REST si la CLI ne supporte pas storage), puis on pousse via `rclone` vers MinIO :

```bash
# Sur l'instance ARC cible — récupérer les credentials MinIO
grep -E '^\s*(minio_access_key|minio_secret_key):' ~/.arc/arc.config.yml
# Si absent du fichier de config, fallback :
docker exec <SUPABASE_KONG_CONTAINER> sh -c 'env | grep -i minio'
```

*Les valeurs `<MINIO_ACCESS_KEY>` et `<MINIO_SECRET_KEY>` ont été générées par `arc setup`. Notez-les avant de continuer.*

```bash
# Sur l'instance ARC cible — configurer rclone vers MinIO local
rclone config create arc-storage s3 \
  provider=Minio \
  endpoint=http://minio:9000 \
  access_key_id=<MINIO_ACCESS_KEY> \
  secret_access_key=<MINIO_SECRET_KEY>

rclone copy \
  --progress \
  /root/migration/<BUCKET_NAME>-export/ \
  arc-storage:<BUCKET_NAME>/
```

Vérifiez via le Studio Supabase (`https://supabase.<DOMAIN>` → Storage → bucket).

#### Étape 6 — Mettre à jour les clés JWT côté frontend

Les `<ARC_ANON_KEY>` et `<ARC_SERVICE_ROLE_KEY>` du Supabase self-hosted sont **différents** de ceux du managé.

**Comment les récupérer (procédure exacte)** :

```bash
# Sur l'instance ARC cible — emplacement primaire : la config arc
grep -E '^\s*(anon_key|service_role_key|jwt_secret):' ~/.arc/arc.config.yml
```

Si les clés n'apparaissent pas dans `~/.arc/arc.config.yml` (versions antérieures du CLI), lisez-les directement dans la config Kong du Supabase self-hosted :

```bash
# Sur l'instance ARC cible — fallback : container Kong
docker ps --filter "label=com.docker.compose.project=local-ai-packaged" --format '{{.Names}}' | grep -i kong
# Utilisez le nom retourné comme <SUPABASE_KONG_CONTAINER>
docker exec <SUPABASE_KONG_CONTAINER> sh -c 'grep -E "(anon|service_role|JWT_SECRET)" /home/kong/kong.yml /home/kong/.env 2>/dev/null'
```

Notez les 3 valeurs : `<ARC_ANON_KEY>`, `<ARC_SERVICE_ROLE_KEY>`, `<ARC_JWT_SECRET>`.

**Conséquences sur l'app** :

- Côté frontend (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) : **doit être remplacée** par `<ARC_ANON_KEY>`. Toute build / déploiement ultérieur devra utiliser la nouvelle valeur.
- Côté backend (server actions, route handlers utilisant `service_role`) : remplacer `SUPABASE_SERVICE_ROLE_KEY` par `<ARC_SERVICE_ROLE_KEY>`.
- `NEXT_PUBLIC_SUPABASE_URL` : passe de `https://<SOURCE_PROJECT_REF>.supabase.co` à `https://supabase.<DOMAIN>`.

> ⚠️ **Sessions utilisateurs invalidées** : les JWT déjà en circulation (cookies, tokens stockés en localStorage côté clients) sont signés avec `<SOURCE_JWT_SECRET>`. Le Supabase self-hosted utilise `<ARC_JWT_SECRET>`. **Tous vos utilisateurs seront déconnectés à la bascule** et devront se reconnecter. C'est attendu — communiquez-le si nécessaire.
>
> *Alternative (avancée, hors scope §1.b) : copier `<SOURCE_JWT_SECRET>` dans la config du Supabase self-hosted pour préserver les sessions. Cela demande de regénérer ses propres `anon`/`service_role` à partir du même secret. Si la demande remonte, la procédure sera ajoutée.*

#### Étape 7 — Réimporter les Edge Functions

Si vous utilisez des Edge Functions Deno :

```bash
# Sur votre poste local — récupérer le code source des fonctions managées
supabase functions list
git clone <YOUR_REPO_WITH_FUNCTIONS>
cd <REPO>
# Ou, si les sources des fonctions sont déjà dans votre repo : cd vers supabase/functions/
```

> **Sémantique des credentials** :
> - `SUPABASE_ACCESS_TOKEN` = **token personnel utilisateur** de la CLI Supabase, généré par `supabase login` ; il authentifie *vous* auprès de l'API Supabase Cloud (`api.supabase.com`).
> - `SERVICE_ROLE_KEY` = **JWT projet** server-side, signé par le `JWT_SECRET` du projet ; il bypasse RLS et représente *le projet*, pas un utilisateur.
>
> Côté self-hosted, le déploiement va directement au container `functions` qui tourne sur votre VPS — pas d'intermédiaire `api.supabase.com` comme pour le managé. C'est plus simple sur le papier mais la CLI Supabase, conçue d'abord pour le Cloud, s'adapte avec quelques flags spécifiques (voir voie A ci-dessous).

**Voie A — CLI Supabase ≥ 1.200.0 (`--no-verify-jwt` + URL custom)** :

```bash
# Sur votre poste local
export SUPABASE_URL="https://supabase.<DOMAIN>"

# Déploiement direct vers l'instance self-hosted (pas via supabase.com)
supabase functions deploy <FUNCTION_NAME> \
  --no-verify-jwt \
  --use-api \
  --project-ref local
# ⚠️ Syntaxe à confirmer pendant E2E-001 — la CLI Supabase évolue rapidement sur ce point.
```

> ℹ️ **Pourquoi `--no-verify-jwt`** : ce flag est nécessaire au **déploiement** côté self-hosted parce que la CLI Supabase n'a pas de service Cloud à interroger pour résoudre la config du projet. **Il porte uniquement sur l'étape de deploy.**
>
> Au runtime, la sécurité de votre fonction dépend **de votre code** :
> - Si votre fonction vérifie le JWT explicitement (`createClient` + `supabase.auth.getUser()` ou équivalent), elle est sécurisée — comme côté managé.
> - Si votre fonction ne vérifie pas le JWT, elle est ouverte au public — mais c'était **déjà le cas côté managé**, donc ce flag ne change rien.
>
> **Conclusion** : `--no-verify-jwt` au deploy ne change PAS la sécurité runtime de votre fonction. C'est néanmoins une bonne occasion d'auditer si vos fonctions valident bien leur caller.

**Voie B — Déploiement manuel par bundle (toujours fonctionnel)** :

```bash
# Sur votre poste local — bundler la fonction en zip
cd supabase/functions/<FUNCTION_NAME>
zip -r /tmp/<FUNCTION_NAME>.zip .

# Pousser le bundle via l'API REST du service functions self-hosted
curl -X POST "https://supabase.<DOMAIN>/functions/v1/admin/functions/<FUNCTION_NAME>" \
  -H "Authorization: Bearer <ARC_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/zip" \
  --data-binary "@/tmp/<FUNCTION_NAME>.zip"
```

Ici on utilise bien `<ARC_SERVICE_ROLE_KEY>` (et non un access token personnel) parce qu'on parle directement à l'instance self-hosted : c'est le JWT projet qui authentifie l'opération côté Kong gateway.

Vérifiez :

```bash
# Sur votre poste local
curl -i "https://supabase.<DOMAIN>/functions/v1/<FUNCTION_NAME>" \
  -H "Authorization: Bearer <ARC_ANON_KEY>"
```

#### Étape 8 — Connecter le repo Git, configurer les env vars, déployer

Identique à §1.a étape 5 et 6, **avec les valeurs ARC** pour les variables Supabase :

```
NEXT_PUBLIC_SUPABASE_URL=https://supabase.<DOMAIN>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ARC_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<ARC_SERVICE_ROLE_KEY>
```

Lancez le déploiement comme en §1.a étape 6.

#### Étape 9 — Bascule DNS et reconnexion Realtime

Suivez §1.a étape 7 pour la bascule DNS.

> ℹ️ **Realtime** : les clients web utilisant `supabase.channel(...).subscribe()` détectent une déconnexion WebSocket pendant la bascule et tentent une reconnexion automatique. Cependant, comme les JWT ont changé (étape 6), les clients déjà chargés en mémoire vont échouer la reconnexion tant qu'un **rechargement complet de la page** n'a pas eu lieu. Si l'UX le permet, déclenchez un `window.location.reload()` côté client après détection d'une 401 sur les WS.

#### Étape 10 — Vérification post-migration

```bash
# Sur votre poste local
curl -I https://app.example.com
curl "https://supabase.<DOMAIN>/auth/v1/health"
curl "https://supabase.<DOMAIN>/storage/v1/health"
```

Smoke test fonctionnel à valider manuellement :

- Connexion d'un utilisateur existant (vérifier que les hashs bcrypt fonctionnent).
- Lecture d'une ressource protégée par RLS (vérifier que les policies sont bien en place).
- Upload + lecture d'un fichier dans un bucket Storage.
- Si Edge Functions : appel d'au moins une fonction qui touche la DB.
- Si Realtime : ouverture d'un canal et réception d'un INSERT en live.

#### Étape 11 — Désactivation, cleanup, et migration des secrets

Suivez §1.a étape 9 pour Vercel + Postgres source. Ajouts spécifiques Supabase :

1. Dans le projet Supabase managé : **Settings → General → Pause project** (puis suppression définitive après 30 jours sans incident).
2. Sur l'instance ARC, supprimez les exports Storage temporaires :

```bash
# Sur l'instance ARC cible — après validation §10 (24 h)
rm -rf /root/migration/<PROJECT_NAME>.supabase.dump*
rm -rf /root/migration/<BUCKET_NAME>-export
```

3. Mettez à jour vos secrets côté Vercel/CI si vous gardez un environnement de preview (le projet Vercel pause peut rester pour la preview avec les nouvelles clés ARC, à votre choix).

#### Cas de bord identifiés (hors scope strict de §1.b)

- **OAuth providers (Google, GitHub…)** : les `redirect_uri` enregistrés côté provider pointent vers `<SOURCE_PROJECT_REF>.supabase.co/auth/v1/callback`. Deux actions, dans deux endroits différents :
  1. **Côté provider** (console Google Cloud / GitHub Developer Settings) : ajoutez `https://supabase.<DOMAIN>/auth/v1/callback` à la liste des Authorized redirect URIs.
  2. **Côté Supabase self-hosted** : ouvrez **Supabase Studio** (`https://supabase.<DOMAIN>`, **pas** Coolify) → Authentication → Providers → Google/GitHub → collez les `client_id` et `client_secret` du provider.

  *Supabase Studio est une UI dédiée différente de Coolify : Coolify gère vos déploiements applicatifs, Studio gère votre base et vos services Supabase.*
- **Magic links / Email confirmation / Reset password** : nécessitent un serveur SMTP configuré côté Supabase self-hosted. Côté Supabase managé, vous bénéficiiez d'un envoi par défaut (limité). Côté self-hosted, **rien n'est configuré par défaut** — vous devez fournir un SMTP (Resend, Postmark, Brevo, votre propre serveur). Configuration : Supabase Studio → **Project Settings → Auth → SMTP Settings**.

  📚 [Doc Supabase officielle — SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp)
- **Vector / pgvector** : si vous utilisez `pgvector`, vérifiez que l'extension est activée côté self-hosted (`CREATE EXTENSION IF NOT EXISTS vector;`) avant la restauration.
- **Préservation du JWT secret** (sessions actives non invalidées) : voir note avancée §6 — non couvert tant qu'un cas réel ne le demande pas.

---

## §2 — Déplacer un projet d'une instance ARC à une autre

**Cas d'usage cible** : vous avez deux instances ARC fonctionnelles — typiquement un ancien VPS et un nouveau plus puissant — et vous voulez **déplacer un seul projet** de l'instance A vers l'instance B, sans toucher aux autres projets de A.

*Pourquoi cette procédure manuelle plutôt qu'une commande unique ?* Avant la version 0.2 d'ARC, une commande `arc migrate --from=A --to=B` orchestrait ce déplacement. Le modèle d'install single-machine acté par [ADR-0012](./03-architecture-decisions/0012-single-machine-install.md) a supprimé cette commande pour simplifier le code et la sécurité (plus de SSH outbound piloté par le CLI). Le déplacement reste possible — il passe désormais par la séquence `arc backup` → `scp` → `arc restore`, documentée ci-dessous.

**Estimation** : ~15–20 min de manipulation (par projet, hors propagation DNS).

> **TL;DR pour devs avancés** :
> 1. Sur A : `arc backup` global, puis `pg_dump` ciblé sur `<PROJECT_NAME>_db` + tar des volumes filtrés par label `coolify.projectName=<PROJECT_NAME>`.
> 2. `scp` du dump et des tarballs vers B.
> 3. Sur B : `arc project add <PROJECT_NAME>` puis `pg_restore --clean --if-exists` + `tar -xzf` dans les volumes nommés.
> 4. Repo Git + envvars dans Coolify (UI, jusqu'à ce que `arc project set-repo` / `set-env` existent).
> 5. Smoke test fonctionnel sur B → bascule DNS → 24 h → `arc project ... → Delete Project` côté A.

**Prérequis** :

- Instance ARC **A** (source) : `arc status` retourne `Running`, le projet `<PROJECT_NAME>` y tourne.
- Instance ARC **B** (cible) : `arc status` retourne `Running`. Si vous voulez réutiliser le même `<DOMAIN>` que A, vous devrez le retirer de A avant de l'attacher à B (étape 5).
- Accès SSH root aux deux instances depuis votre poste local.

#### Étape 1 — Préparer le dossier de migration sur B

```bash
# Sur l'instance ARC B (cible)
mkdir -p /root/migration && chmod 700 /root/migration
arc status
arc project list
```

Vérifiez qu'aucun projet existant sur B ne porte déjà le nom `<PROJECT_NAME>` (collision de noms).

#### Étape 2 — Créer le dump applicatif sur A

`arc backup` produit un snapshot **global** de l'instance (toutes les bases + volumes). Pour un déplacement chirurgical d'**un seul projet**, on extrait ensuite la portion qui nous intéresse.

```bash
# Sur l'instance ARC A (source)
arc backup
# Notez le <BACKUP_ID> affiché à la fin (format : YYYY-MM-DD-HHMM)
ls -lh ~/backups/
```

Le backup contient typiquement :

- `db_<BACKUP_ID>.sql` (dump pg_dumpall de tous les projets)
- `volumes_<BACKUP_ID>.tar.gz` (snapshots des volumes Docker nommés)

Extrayez la portion qui concerne uniquement `<PROJECT_NAME>` :

```bash
# Sur l'instance ARC A — extraire le dump SQL du seul projet
docker exec <POSTGRES_CONTAINER> pg_dump \
  --no-owner \
  --no-acl \
  --format=custom \
  --dbname=<PROJECT_NAME>_db \
  --username=<DB_USER> \
  > /root/migration/<PROJECT_NAME>.dump

# Sur l'instance ARC A — lister les volumes Docker du projet
docker volume ls --filter "label=coolify.projectName=<PROJECT_NAME>" --format '{{.Name}}'
```

Pour chaque volume retourné, snapshotter :

```bash
# Sur l'instance ARC A — pour chaque <VOLUME_NAME> trouvé ci-dessus
docker run --rm \
  -v <VOLUME_NAME>:/data:ro \
  -v /root/migration:/backup \
  alpine \
  tar -czf /backup/<VOLUME_NAME>.tar.gz -C /data .
```

*Lecture de la commande, pour qui n'écrit pas du Docker ad-hoc tous les jours :*
- *`docker run --rm` lance un container temporaire qui sera supprimé dès qu'il aura fini.*
- *`-v <VOLUME_NAME>:/data:ro` monte le volume Docker à snapshotter en lecture seule sous `/data` dans le container.*
- *`-v /root/migration:/backup` monte votre dossier de migration sous `/backup` dans le container, en lecture-écriture.*
- *`alpine` est une image Linux ultra-légère (~5 Mo) qui contient `tar` — n'importe quelle image avec tar fonctionnerait, mais alpine se télécharge en 2 secondes.*
- *`tar -czf /backup/<VOLUME_NAME>.tar.gz -C /data .` produit l'archive compressée du contenu du volume.*

*Le résultat : `/root/migration/<VOLUME_NAME>.tar.gz` côté hôte VPS, prêt à être transféré.*

#### Étape 3 — Transférer vers B

Le chemin le plus simple : passer par votre poste local (téléchargez depuis A, uploadez vers B). C'est plus lent qu'un transfert direct A → B mais ça évite de configurer le SSH côté A pour qu'il puisse lui-même atteindre B :

```bash
# Sur votre poste local
scp root@<VPS_A_IP>:/root/migration/<PROJECT_NAME>.dump ./
scp root@<VPS_A_IP>:/root/migration/*.tar.gz ./

scp <PROJECT_NAME>.dump root@<VPS_B_IP>:/root/migration/
scp *.tar.gz root@<VPS_B_IP>:/root/migration/
```

*Si vous savez ce qu'est l'**SSH agent forwarding** (option `-A` de `ssh`, qui permet à A d'utiliser votre clé SSH pour se connecter à B sans qu'A ne stocke la clé), vous pouvez transférer en direct A → B et économiser le passage par le poste local. Sinon, restez sur la procédure ci-dessus, c'est très bien.*

#### Étape 4 — Restaurer sur B

Créez l'enveloppe projet sur B :

```bash
# Sur l'instance ARC B
arc project add <PROJECT_NAME>
# Notez les <DB_USER>/<DB_PASS> retournés — ils sont DIFFÉRENTS de ceux de A
```

Restaurez le dump SQL dans la base nouvellement créée :

```bash
# Sur l'instance ARC B — identifier le container Postgres (cf. §1.a étape 4)
docker ps --filter "label=com.docker.compose.project=local-ai-packaged" --format '{{.Names}}'

# Sur l'instance ARC B — restaurer
docker exec -i <POSTGRES_CONTAINER> pg_restore \
  --no-owner \
  --no-acl \
  --dbname=<PROJECT_NAME>_db \
  --username=<DB_USER> \
  --clean \
  --if-exists \
  < /root/migration/<PROJECT_NAME>.dump
```

Restaurez chaque volume Docker. **Le projet doit exister sur B (étape précédente)** pour que les volumes nommés cibles existent — sans cela, la commande créerait un volume vide non rattaché à votre projet.

```bash
# Sur l'instance ARC B — pour chaque <VOLUME_NAME>.tar.gz transféré
docker run --rm \
  -v <VOLUME_NAME>:/data \
  -v /root/migration:/backup \
  alpine \
  sh -c "cd /data && tar -xzf /backup/<VOLUME_NAME>.tar.gz"
```

*Pattern miroir de l'étape 2 : container temporaire alpine, le volume cible monté en `:rw`, le dossier de migration en lecture, `tar -xzf` extrait l'archive dans le volume.*

#### Étape 5 — Configurer le déploiement sur B

> ℹ️ **Note CLI vs UI** : à ce jour le CLI `arc` ne couvre pas la connexion repo Git, l'injection d'env vars projet, ni l'attachement de domaines custom (cf. §1.a étape 5). Les sous-étapes 5.a, 5.b et 5.c passent donc par l'UI Coolify. Cohérence avec §1.a — les commandes CLI futures (`arc project set-repo`, `arc project set-env`, `arc project add-domain`) seront ajoutées dans des tâches CLI ultérieures et remplaceront ces manips UI dans les deux sections en même temps.

**5.a — Connecter le repo Git** (UI Coolify, cf. §1.a étape 5) :

Ouvrez `https://coolify.<DOMAIN_B>` → projet `<PROJECT_NAME>` → **Source** → ajoutez votre repo Git (GitHub App ou Deploy Key). **Build pack** : laissez sur `Nixpacks`.

**5.b — Injecter les env vars** (UI Coolify) :

Récupérez les env vars depuis Coolify A : projet `<PROJECT_NAME>` → onglet **Environment Variables** → bouton **Copy** / export. Collez-les dans Coolify B → projet `<PROJECT_NAME>` → **Environment Variables**.

**Mettez à jour `DATABASE_URL`** avec les credentials retournés par `arc project add` sur B (différents de ceux de A) :

```
DATABASE_URL=postgresql://<DB_USER_B>:<DB_PASS_B>@postgres:5432/<PROJECT_NAME>_db
```

> ⚠️ Les env vars ne sont **pas** dans le dump SQL transféré à l'étape 3. Cette étape ne peut pas être omise.

**5.c — Configurer le domaine custom** (UI Coolify) :

Si vous gardez le même domaine custom que sur A :

1. Sur Coolify A → projet → **Domains** → **retirez** le domaine custom.

   🔍 **Pourquoi** : pour émettre un certificat SSL, Let's Encrypt vérifie que vous contrôlez le domaine en plaçant un fichier à `http://<DOMAIN>/.well-known/acme-challenge/...` (c'est le "challenge HTTP-01"). Si A et B prétendent tous deux servir le même domaine, le challenge tombe parfois sur A, parfois sur B, et Let's Encrypt rejette les deux. En retirant le domaine de A, vous garantissez que seul B reçoit le challenge.
2. Sur Coolify B → projet → **Domains** → **ajoutez** le domaine custom.
3. Mettez à jour le record DNS pour pointer vers `<VPS_B_IP>` (cf. §1.a étape 7).

**5.d — Déployer** (CLI) :

```bash
# Sur l'instance ARC B
arc project deploy <PROJECT_NAME>
arc logs <PROJECT_NAME>
```

#### Étape 6 — Smoke test fonctionnel sur B avant nettoyage de A

Avant **toute** suppression côté A, validez sur B :

- HTTP 200 sur la home (cf. §1.a étape 8) :
  ```bash
  # Sur votre poste local
  curl -I https://<PROJECT_NAME>.<DOMAIN_B>
  # Si custom domain bascullé :
  curl -I https://<CUSTOM_DOMAIN>
  ```
- Connexion d'un utilisateur existant (login + lecture d'une donnée perso protégée).
- Au moins **un flux critique métier** propre à votre app (paiement de test, upload, OAuth, formulaire critique — selon votre projet).
- Logs Coolify (onglet Logs du projet) : aucun 5xx récurrent.
- Aucune erreur dans `arc logs <PROJECT_NAME>`.

> 🛑 **Tant qu'un seul de ces points échoue, NE TOUCHEZ PAS À A.** Diagnostiquez sur B, corrigez, re-déployez (`arc project deploy <PROJECT_NAME>`), recommencez le smoke test. A reste votre filet de sécurité — la suppression à l'étape 7 est définitive.

#### Étape 7 — Nettoyer A

Une fois **les deux conditions** réunies — 24 h écoulées sans incident **et** smoke test fonctionnel passé (étape 6) — désactivez le projet sur A :

```bash
# Sur l'instance ARC A — lister les volumes pour mémoire avant suppression
docker volume ls --filter "label=coolify.projectName=<PROJECT_NAME>" --format '{{.Name}}'
# (Conservez un backup local de ces volumes au moins 30 jours avant de les supprimer.)
```

Dans Coolify A : projet `<PROJECT_NAME>` → **Delete Project**. Cela retire l'app de Coolify et libère son sous-domaine `<PROJECT_NAME>.<DOMAIN_A>`.

```bash
# Sur les deux instances — nettoyer les fichiers temporaires
rm -rf /root/migration/<PROJECT_NAME>.dump /root/migration/*.tar.gz
```

> ℹ️ **CLI gap connu** : un `arc project move <PROJECT_NAME> --to=<VPS_B_IP>` qui orchestrerait les étapes 2 → 5 serait un wrapper utile, à proposer dans une tâche CLI ultérieure.

---

## §3 — Dupliquer une instance ARC en staging

**Cas d'usage cible** : vous avez une instance ARC en **production**. Vous voulez créer une **copie complète sur un VPS séparé** (tous projets, toutes les bases, tous les volumes, toutes les env vars) pour tester une upgrade de stack, une migration risquée, ou un ADR refactor avant de le déployer en prod. À la différence de §2 (un projet), §3 clone **l'instance entière**.

**Estimation** : ~30 min de manipulation pour une instance de taille moyenne (3–5 projets), hors propagation DNS et hors temps de transfert R2.

> **TL;DR pour devs avancés** :
> 1. `arc backup` sur prod → upload vers bucket R2 prod.
> 2. `arc setup` sur le VPS staging avec `<DOMAIN_STAGING>` distinct + bucket R2 staging dédié.
> 3. Pointer temporairement R2 du staging vers le bucket prod (clé RO) → `arc restore <BACKUP_ID>` → revenir au bucket staging.
> 4. Différencier : domaines (4.a), secrets sensibles + JWT_SECRET rotation recommandée (4.b), anonymisation RGPD (4.c), désactivation jobs externes (4.d).
> 5. Smoke test d'isolation prod ↔ staging.

> 🛡️ **RGPD — lire avant de cloner.** Les données utilisateurs en prod **ne doivent pas** se retrouver telles quelles en staging, sauf si votre staging est aussi protégé que la prod (mêmes contrôles d'accès, mêmes engagements de durabilité, mêmes politiques de suppression).
>
> *Concrètement, pour un solo founder : si seul vous avez accès à la prod, mais que vous donnez accès au staging à un freelance, un cofounder, ou n'importe quelle autre personne, alors staging est moins protégé que prod et l'anonymisation devient obligatoire.*
>
> Dans la pratique, staging est souvent moins protégé. Si votre prod contient des données personnelles, **anonymisez** la copie avant ou immédiatement après la restauration sur B (cf. étape 4 ci-dessous, sous-section "Anonymisation"). Cette responsabilité est entièrement de votre côté — ARC ne fait pas l'anonymisation pour vous.

**Prérequis** :

- Instance ARC **prod** (A) en bon état, sauvegarde R2 configurée (`backups.remote.bucket` dans `arc.config.yml`).
- Un **second VPS vierge** identique ou supérieur en taille à la prod — futur staging (B).
- Un **second domaine** distinct pour staging : `<DOMAIN_STAGING>` (ex : `staging.euglowlabs.com`). **Ne réutilisez jamais le même `<DOMAIN>` que la prod.**

#### Étape 1 — Backup global de la prod

```bash
# Sur l'instance ARC prod (A)
arc backup
# Le backup est uploadé vers le bucket R2 prod (ex : arc-backups-prod).
# Notez le <BACKUP_ID> retourné.
```

Vérifiez que l'upload R2 a réussi :

```bash
# Sur l'instance ARC prod
ls -lh ~/backups/<BACKUP_ID>*
arc status
# Cherchez la ligne mentionnant le dernier upload vers le bucket prod.
```

#### Étape 2 — Installer ARC sur le VPS staging

Suivez la procédure d'installation standard (cf. [ADR-0012](./03-architecture-decisions/0012-single-machine-install.md)) :

```bash
# Sur le VPS staging (B), connecté en SSH root
curl -fsSL https://install-arc.euglowlabs.com | sh
arc setup
```

Pendant `arc setup`, **utilisez `<DOMAIN_STAGING>`** (pas le domaine de prod). Configurez R2 avec un **bucket dédié staging** (ex : `arc-backups-staging`), distinct du bucket prod. Cela protège contre toute écriture accidentelle de staging vers prod, permet des lifecycle policies différentes (rétention prod 30 j, staging 3 j typiquement), et rend les coûts traçables séparément.

*Création du bucket côté Cloudflare R2 (procédure persona B) :*
1. *Cloudflare dashboard → **R2** → **Create bucket** → nom : `arc-backups-staging` → région proche de votre VPS staging.*
2. *R2 → **Manage R2 API tokens** → **Create API token** → permissions : `Object Read & Write` limitées à ce seul bucket.*
3. *Notez l'access_key_id et le secret_access_key affichés une seule fois — collez-les dans `~/.arc/arc.config.yml` côté staging quand `arc setup` les demande.*

Pour l'étape suivante (restauration depuis le backup prod), prévoyez en plus une **clé R2 en lecture seule** sur le bucket prod, à utiliser ponctuellement le temps du `arc restore` initial.

#### Étape 3 — Restaurer sur staging depuis le bucket prod

`arc restore` doit lire le backup depuis le **bucket prod** (où le `<BACKUP_ID>` de l'étape 1 a été poussé), pas depuis le bucket staging dédié à B.

> 🛡️ **Sécurité — créer une clé R2 lecture seule sur le bucket prod, jamais utiliser votre clé prod RW** :
> 1. *Cloudflare dashboard → **R2** → **Manage R2 API tokens** → **Create API token**.*
> 2. *Permissions : `Object Read only`.*
> 3. *Bucket : sélectionnez **uniquement** `arc-backups-prod` (pas tous les buckets).*
> 4. *TTL recommandé : 24 h (la clé expire automatiquement après la restauration).*
> 5. *Notez `<PROD_BUCKET_RO_ACCESS_KEY>` et `<PROD_BUCKET_RO_SECRET_KEY>`.*
>
> *Ne réutilisez **jamais** votre clé R2 prod en lecture-écriture pour cette étape, même temporairement : un script staging buggé pourrait supprimer vos backups prod. La clé RO empêche cette catégorie d'erreur par construction.*

Pointez temporairement R2 vers le bucket prod en lecture seule :

```bash
# Sur l'instance ARC staging (B) — pointer R2 vers le bucket prod en RO
# Éditez ~/.arc/arc.config.yml et adaptez la section backups.remote :
#   backups:
#     remote:
#       bucket: arc-backups-prod
#       access_key_id: <PROD_BUCKET_RO_ACCESS_KEY>
#       secret_access_key: <PROD_BUCKET_RO_SECRET_KEY>
nano ~/.arc/arc.config.yml
```

Lancez la restauration :

```bash
# Sur l'instance ARC staging (B)
arc restore <BACKUP_ID>
# arc restore propose une liste interactive si aucun ID n'est fourni.
```

`arc restore` télécharge le backup depuis le bucket prod, restaure les bases via `pg_restore`, et remonte les volumes Docker. Suivez les logs.

Une fois la restauration terminée, **revenez à la configuration staging** (bucket `arc-backups-staging` en lecture/écriture) pour que les futurs `arc backup` sur B écrivent dans le bon bucket :

```bash
# Sur l'instance ARC staging (B) — revenir à la config staging
nano ~/.arc/arc.config.yml
# Restaurez backups.remote sur le bucket arc-backups-staging avec sa clé RW.
```

#### Étape 4 — Différencier staging de la prod

Une duplication brute donne une copie **identique** à la prod, **y compris ses secrets, ses domaines, et ses certificats**. Vous devez maintenant casser cette identité sur les éléments sensibles. Sans ces différenciations, staging peut accidentellement envoyer des emails à de vrais clients, débiter de vraies cartes Stripe, ou exposer des données prod sur un domaine non protégé.

**4.a — Réécrire le domaine de tous les projets** :

Pour chaque projet listé par `arc project list` sur B, dans Coolify (`https://coolify.<DOMAIN_STAGING>`) → projet → **Domains** :

- Retirer le domaine custom de prod (ex : `app.euglowlabs.com`).
- Ajouter le domaine équivalent staging (ex : `app.staging.euglowlabs.com`).

Côté DNS, créez les records correspondants pointant sur l'IP du VPS staging.

**4.b — Remplacer les secrets sensibles** :

Liste minimale par projet (à adapter à votre stack) :

- `STRIPE_SECRET_KEY` → clé de **test** Stripe (`sk_test_...`)
- `RESEND_API_KEY` / `SENDGRID_API_KEY` → clé sandbox ou compte d'envoi dédié staging
- `OPENAI_API_KEY` → projet OpenAI dédié staging avec budget plafonné
- Tout webhook secret tiers (GitHub, Linear, Slack…) → pointer vers une URL staging et regénérer le secret côté provider

Procédure : Coolify → projet → **Environment Variables** → modifier chaque ligne sensible. Redéployer le projet pour propager (`arc project deploy <PROJECT_NAME>`).

**JWT_SECRET du Supabase self-hosted — décision explicite à prendre** :

Le Supabase self-hosted déployé par `arc setup` a généré son propre `<JWT_SECRET>`. Lors du `arc restore` à l'étape 3, l'écrasement des données + des configs a recopié le `<JWT_SECRET>` de prod sur staging. Vous avez deux options :

> **Option 1 (sécurisé, recommandé) — Régénérer `JWT_SECRET` côté staging.**
>
> 1. Générer un nouveau secret :
>    ```bash
>    # Sur votre poste local
>    openssl rand -base64 64
>    ```
> 2. Mettre à jour la config :
>    ```bash
>    # Sur l'instance ARC staging
>    nano ~/.arc/arc.config.yml
>    # Section : supabase.jwt_secret → coller la nouvelle valeur
>    ```
> 3. Redéployer la stack Supabase pour que Kong et GoTrue rechargent le nouveau secret. **La procédure exacte dépend de la commande `arc setup --reconfigure` qui n'est pas encore livrée (cf. INSTALL-001)** ; en attendant, redémarrez manuellement les containers Supabase :
>    ```bash
>    # Sur l'instance ARC staging
>    docker compose --project-name local-ai-packaged restart
>    ```
>
>    *Cette commande redémarre uniquement les containers du bundle `local-ai-packaged` (Supabase, Ollama, n8n, etc.) — vos projets Coolify (vos apps Next.js) **ne sont pas touchés** et continuent à tourner. Ils verront simplement Supabase indisponible pendant 30–60 secondes le temps du restart, puis se reconnecteront automatiquement.*
> 4. Récupérer les nouveaux `<ARC_ANON_KEY>` et `<ARC_SERVICE_ROLE_KEY>` (cf. §1.b étape 6).
> 5. Mettre à jour les env vars `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` de **tous** les projets sur staging.
> 6. Redéployer chaque projet (`arc project deploy <PROJECT_NAME>`).

> **Option 2 (rapide, à risque) — Conserver le `JWT_SECRET` de prod.**
>
> ⚠️ **Tant que cette rotation n'est pas faite, considérez staging aussi sensible que prod côté auth.**
>
> Concrètement : tout token JWT signé par la prod reste valide sur staging et inversement. Tout fuite côté staging (logs, capture d'écran lors d'un debug, accès devs élargi) **est** une fuite prod. Ne donnez pas l'accès staging à plus de personnes qu'à prod, et traitez tout incident staging comme un incident prod tant que la rotation n'a pas eu lieu.

**4.c — Anonymisation des données utilisateurs (RGPD)** :

Si votre prod contient des données personnelles, **avant** que staging ne soit accessible à votre équipe, anonymisez.

*Procédure recommandée : exécutez d'abord le script dans une transaction explicite avec `BEGIN; ... ROLLBACK;` pour vérifier le résultat, puis seulement après remplacez `ROLLBACK` par `COMMIT`. Cela vous laisse vérifier l'effet sans risque de casse.*

Exemple SQL générique adaptable à votre schéma :

```bash
# Sur l'instance ARC staging — exemple à ADAPTER À VOTRE SCHÉMA
docker exec -i <POSTGRES_CONTAINER> psql --username=postgres --dbname=postgres <<'SQL'
BEGIN;

UPDATE auth.users
SET email = 'user-' || id || '@example.invalid',
    phone = NULL,
    raw_user_meta_data = '{}'::jsonb;

-- Ajoutez vos tables applicatives ici, ex :
-- UPDATE public.profiles SET full_name = 'Test User ' || id, address = NULL;
-- UPDATE public.payments SET stripe_payment_intent_id = NULL;

-- Vérifiez les résultats avec quelques SELECT puis :
-- ROLLBACK;  -- pour annuler (mode dry-run)
-- COMMIT;    -- pour valider
ROLLBACK;
SQL
```

*La syntaxe `<<'SQL' ... SQL` est un **here-document** Bash : tout ce qui est entre les deux marqueurs `SQL` est passé en entrée standard à `psql`. Les guillemets simples `'SQL'` empêchent toute interprétation des `$variables` du shell — le SQL est passé tel quel.*

> ⚠️ Ce snippet est volontairement minimal. **Adaptez-le à votre modèle de données** : toutes les colonnes contenant noms, emails, téléphones, adresses, IDs externes, fichiers privés. Une anonymisation incomplète = pas d'anonymisation.

**4.d — Désactiver les jobs / webhooks externes** :

- Si vous utilisez **n8n** (orchestrateur de workflows déployé par défaut dans la stack `local-ai-packaged`, accessible via `https://n8n.<DOMAIN_STAGING>`), coupez les workflows qui envoient vers des destinataires externes réels (emails de transaction, webhooks Slack/Discord vers des canaux d'équipe, posts sur les réseaux sociaux…). Pratique : un workflow staging avec les mêmes triggers que la prod va se déclencher sur des données restaurées et envoyer des notifications fantômes à de vrais destinataires. *Si vous n'utilisez pas n8n, ignorez ce point.*
- Désactivez les crons systemd qui pourraient déclencher des actions cross-environnement.
- Vérifiez que `arc backup` sur staging écrit bien dans `arc-backups-staging` et **jamais** dans le bucket prod (configuration acquise à l'étape 2 + retour à la config staging fin de l'étape 3).

#### Étape 5 — Vérifier l'isolation prod ↔ staging

```bash
# Sur votre poste local
curl -I https://app.staging.euglowlabs.com
curl -I https://app.euglowlabs.com  # doit toujours répondre depuis la prod
```

Smoke test par projet :

- Connexion utilisateur fonctionnelle (avec le compte de test que vous venez d'anonymiser).
- Pas d'envoi d'email vers une vraie boîte (vérifier les logs SMTP).
- Pas de débit Stripe en mode live (les clés `sk_test_*` doivent être en place).

#### Étape 6 — Routine de re-synchronisation périodique

En pratique, staging dérive de prod au fil du temps. Pour le re-synchroniser :

1. Refaire `arc backup` sur prod.
2. `arc restore <BACKUP_ID>` sur staging.
3. **Re-jouer l'étape 4** (réécrire domaines, remplacer secrets, anonymiser).

> ℹ️ **CLI gap connu** : un `arc clone --from=<VPS_PROD_IP> --domain=<DOMAIN_STAGING>` qui orchestrerait étapes 1 → 4.a + 4.b avec un mapping de domaines/secrets serait un wrapper utile. À proposer en tâche CLI ultérieure.

---

## §5 — Rollback d'un déploiement cassé

Trois scénarios de rollback, du plus léger au plus lourd. Choisissez selon le périmètre de la casse.

### §5.1 — Code applicatif cassé (déploiement Coolify foireux)

**Quand l'utiliser** : un `arc project deploy` ou un push Git a déployé une version qui plante (500 systématique, build qui passe mais crash au runtime, régression fonctionnelle visible immédiatement).

**Estimation** : ~5 min.

Coolify n'a pas de bouton "rollback" instantané : on rejoue un commit antérieur. Identifiez le dernier commit sain :

```bash
# Sur votre poste local
git log --oneline -20
# Repérez le SHA du dernier commit qui tournait OK : <LAST_GOOD_SHA>
```

Deux voies équivalentes selon votre workflow :

**Voie A — Revert via Git (préféré, traçable)** :

```bash
# Sur votre poste local
git revert --no-edit <BAD_SHA>..HEAD
git push origin main
```

Coolify détecte le push et redéploie. Suivez :

```bash
# Sur l'instance ARC cible
arc logs <PROJECT_NAME>
```

**Voie B — Forcer un commit antérieur dans Coolify** : projet → onglet **Deployments** → repérez le déploiement antérieur réussi → bouton **Redeploy**. Cela rebuild le commit sain sans toucher à votre branche `main`.

**Test post-rollback** : `curl -I https://<CUSTOM_DOMAIN>` doit retourner 200, et le smoke test fonctionnel critique (cf. §2 étape 6) doit passer.

### §5.2 — Migration de base de données cassée

**Quand l'utiliser** : une migration SQL déployée a corrompu des données ou supprimé des colonnes nécessaires. Le code peut être OK mais la DB n'est plus exploitable.

**Estimation** : ~15 min.

```bash
# Sur l'instance ARC cible — lister les backups locaux disponibles
ls -lh ~/backups/ | tail -20
```

Choisissez `<BACKUP_ID>` antérieur à l'incident (typiquement le backup nocturne précédent). Mettez l'app en mode maintenance (Coolify → projet → **Stop**) pour bloquer toute nouvelle écriture pendant la restauration :

```bash
# Sur l'instance ARC cible
docker stop $(docker ps -q --filter "label=coolify.projectName=<PROJECT_NAME>")
```

*La syntaxe `$(...)` exécute d'abord la sous-commande (lister les IDs des containers du projet) et passe le résultat à `docker stop`. Si la sortie est vide, `docker stop` affiche `requires at least 1 argument` — c'est attendu, ça signifie que le projet n'a pas de container actif, vous pouvez passer à la restauration.*

Restaurez la base du seul projet impacté (procédure §1.a étape 4 inversée) :

```bash
# Sur l'instance ARC cible
docker exec -i <POSTGRES_CONTAINER> pg_restore \
  --no-owner \
  --no-acl \
  --dbname=<PROJECT_NAME>_db \
  --username=<DB_USER> \
  --clean \
  --if-exists \
  < ~/backups/<BACKUP_ID>/<PROJECT_NAME>.dump
```

⚠️ **Boucle infinie à éviter** : si la migration cassée est dans le **code** (Prisma, Drizzle, Knex…) et qu'elle se rejouera automatiquement au prochain démarrage de l'app, vous êtes face à une boucle "DB cassée → restore → app redémarre → migration rejouée → DB cassée à nouveau".

**Avant** de relancer l'app, **revertez le fichier de migration côté code** :

```bash
# Sur votre poste local
# Identifiez le commit qui a introduit la migration cassée
git log --oneline -- <PATH_TO_MIGRATIONS_DIR>
# Revert ce commit spécifiquement
git revert <BAD_MIGRATION_SHA>
git push origin main
```

*Coolify détectera le push et redéploiera avec un code qui ne tente plus la migration cassée. Seulement après, la DB restaurée à l'étape précédente reste cohérente.*

Relancez :

```bash
# Sur l'instance ARC cible
arc project deploy <PROJECT_NAME>
arc logs <PROJECT_NAME>
```

### §5.3 — Stack ARC entière cassée après upgrade

**Quand l'utiliser** : une mise à jour de Coolify, du bundle `local-ai-packaged`, ou de l'OS a rendu plusieurs services inaccessibles. Le rollback léger ne suffit plus, il faut restaurer l'état complet de la machine.

**Estimation** : ~20–30 min selon la taille du backup.

Pré-requis : un `arc backup` antérieur à l'upgrade existe, en local et/ou sur R2.

```bash
# Sur l'instance ARC cible — lister les backups disponibles
arc restore
# Aucun argument → liste interactive des backups locaux + R2.
```

Sélectionnez le backup d'avant l'upgrade. `arc restore` :

1. Stoppe Coolify et la stack `local-ai-packaged`.
2. Restaure les bases via `pg_restore`.
3. Remonte les volumes Docker depuis le tar.gz.
4. Redémarre la stack.

Suivez le retour à la normale :

```bash
# Sur l'instance ARC cible
arc status
# Tous les services doivent retourner Running.
```

> ⚠️ **Avant de retenter l'upgrade**, identifiez la cause de la casse. Sans diagnostic, vous re-jouerez le même bug. Cas typiques : lecture des release notes upstream, vérification d'incompatibilités Postgres / Coolify, audit du `docker-compose.yml` modifié par `arc setup`.

---

## §6 — Troubleshooting (5 cas fréquents)

Chaque cas suit le même pattern : **symptômes** (ce que vous voyez) → **diagnostic** (commandes pour confirmer la cause) → **résolution** (actions concrètes).

### §6.1 — DNS non propagé ou record incorrect

**Symptômes** :

- `curl https://<CUSTOM_DOMAIN>` retourne `Could not resolve host`.
- Coolify reste bloqué en émission de certificat Let's Encrypt.
- Le site répond depuis l'ancienne IP même 1 h après la bascule.

**Diagnostic** :

```bash
# Sur votre poste local — vérifier la résolution depuis votre poste
dig +short <CUSTOM_DOMAIN>
# Attendu : <VPS_IP> (ou la chaîne CNAME prévue)

# Vérifier la résolution depuis plusieurs résolveurs publics
dig @1.1.1.1 +short <CUSTOM_DOMAIN>
dig @8.8.8.8 +short <CUSTOM_DOMAIN>

# Vérifier le TTL du record (durée pendant laquelle l'ancienne valeur est cachée)
dig <CUSTOM_DOMAIN>
# Champ "TTL" sur la ligne de réponse
```

**Résolution** :

- Si `dig +short` retourne **vide** → record manquant côté registrar / Cloudflare. Recréez le A record (ou CNAME) vers `<VPS_IP>`.
- Si `dig +short` retourne **l'ancienne IP** → propagation en cours. Attendez le TTL (visible ci-dessus). Pour forcer le rafraîchissement local du cache DNS, selon votre OS :
  - **Linux** : `sudo systemd-resolve --flush-caches` (ou `sudo resolvectl flush-caches` selon distribution)
  - **macOS** : `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`
  - **Windows** : `ipconfig /flushdns` (cmd ou PowerShell)
  - Sinon, redémarrez votre routeur (effet équivalent côté résolveur amont).
- Si différents résolveurs retournent des valeurs différentes → propagation partielle, attendez 10–30 min de plus.
- Si vous utilisez Cloudflare en mode proxy (orange cloud) : passez temporairement en DNS only (gris) pour permettre l'émission du certificat Let's Encrypt par Coolify, puis remettez en proxy une fois le certificat obtenu.

### §6.2 — Let's Encrypt en échec

**Symptômes** :

- Le navigateur affiche `NET::ERR_CERT_AUTHORITY_INVALID` ou un certificat auto-signé.
- `curl -I https://<CUSTOM_DOMAIN>` retourne une erreur SSL.
- Logs Coolify : `acme: error: 429`, ou `acme: error: 403`, ou `Connection refused on port 80`.

**Diagnostic** :

```bash
# Sur l'instance ARC cible — logs du proxy Coolify (Traefik)
docker logs $(docker ps -q --filter "name=coolify-proxy") --tail=200 2>&1 | grep -iE "acme|error|certificate"

# Vérifier que le port 80 est ouvert et joignable depuis l'extérieur
ufw status | grep -E "80|443"

# Test depuis l'extérieur
# Sur votre poste local
curl -I http://<CUSTOM_DOMAIN>
# Attendu : 301/308 redirect vers HTTPS, jamais "Connection refused"
```

**Résolution** :

- **Erreur 429 (rate limit)** : Let's Encrypt limite à 5 émissions par domaine et par semaine. Attendez la fenêtre de 7 jours, ou basculez temporairement Coolify sur le **serveur staging Let's Encrypt** : il accepte des émissions illimitées mais ne produit pas de certificats valides côté navigateur — utile pour itérer sans toucher au quota.

  *Procédure (si vous voulez la suivre) : Coolify → Settings → Server → onglet **Let's Encrypt** → cochez "Use staging server" → Save. Une fois votre problème corrigé, repassez en production et regénérez les certificats. Coolify utilise Traefik en interne comme reverse proxy ; cette option ajuste sa config sans que vous ayez à éditer un fichier.*
- **Erreur 403 / `unauthorized`** : le challenge HTTP-01 n'aboutit pas. Causes typiques :
  - Port 80 fermé côté UFW → `ufw allow 80/tcp && ufw allow 443/tcp`.
  - Cloudflare proxy (orange cloud) actif → passez en DNS only le temps de l'émission, voir §6.1.
  - DNS pas encore propagé → §6.1.
- **`Connection refused`** : un autre service écoute sur 80/443. `ss -tlnp | grep -E ":(80|443)"` pour identifier, puis stoppez-le.
- Une fois le problème corrigé, forcez Coolify à re-tenter : projet → **SSL** → bouton **Regenerate Certificate**.

### §6.3 — Coolify inaccessible

**Symptômes** :

- `https://coolify.<DOMAIN>` ne répond pas.
- `arc status` indique Coolify en `Stopped` ou `Restarting`.
- Vos projets continuent peut-être à tourner (tant que Coolify ne pilote pas, ils restent dans leur dernier état).

**Diagnostic** :

```bash
# Sur l'instance ARC cible — état des containers Coolify
docker ps -a --filter "name=coolify"

# Logs du container principal
docker logs coolify --tail=200 2>&1 | tail -50

# Conflit de port ?
ss -tlnp | grep -E ":(8000|80|443)"

# Espace disque
df -h /
```

**Résolution** :

- **Container `Exited`** : `docker start coolify`, puis surveillez les logs. Si crash immédiat, lisez les logs pour la cause (souvent : DB Postgres interne de Coolify corrompue, ou secret manquant).
- **Container `Restarting`** : il crashe en boucle. `docker logs coolify --tail=200` pour la cause. Cas classique : volume `coolify-db` plein → libérez de l'espace ou augmentez le volume.
- **Port 8000 occupé par autre chose** : un autre service a démarré dessus. `ss -tlnp` pour l'identifier, le stopper, redémarrer Coolify.
- **UFW bloque** : vérifiez que 443 est ouvert (`ufw status`). Si vous accédez à Coolify uniquement depuis votre poste, pensez aussi à `ufw allow from <YOUR_IP> to any port 443`.
- **Disque plein** : Coolify ne démarre pas si `/var/lib/docker` est saturé.

  ⚠️ **Manipulation destructrice — lire avant d'exécuter**. Procédez par paliers, du moins agressif au plus agressif, et ne passez à l'étape suivante que si la précédente n'a pas suffi :

  ```bash
  # Sur l'instance ARC cible — palier 1 : purger les images, networks, build cache (sans toucher aux volumes)
  docker system prune -a

  # Vérifier l'espace libéré
  df -h /
  ```

  ```bash
  # Sur l'instance ARC cible — palier 2 (si palier 1 insuffisant) : purger AUSSI les volumes orphelins
  # Un volume orphelin = un volume non rattaché à un container actif.
  # Les volumes de vos projets actifs (DB, storage) ne sont PAS orphelins, donc PAS supprimés.
  # MAIS : un projet temporairement stoppé peut voir ses volumes considérés orphelins. Vérifiez avant.
  docker volume ls --filter dangling=true
  # Lisez la liste retournée. Si tout est OK :
  docker system prune --volumes -a
  ```

  *Le palier 1 résout 90 % des cas. Le palier 2 ne doit être utilisé qu'après vérification explicite de la liste des volumes "dangling" — un volume mal taggué de votre projet pourrait s'y retrouver.*

### §6.4 — Postgres OOM (out of memory)

**Symptômes** :

- Plusieurs apps simultanément en erreur 500 ou 502.
- `docker logs <POSTGRES_CONTAINER> --tail=200` montre `Out of memory` ou `terminated by signal 9`.
- Le journal système : `dmesg | grep -i kill` montre l'OOM killer ayant tué Postgres.

**Diagnostic** :

```bash
# Sur l'instance ARC cible — utilisation mémoire actuelle
free -h
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Logs Postgres : OOM, slow queries, locks
docker logs <POSTGRES_CONTAINER> --tail=500 2>&1 | grep -iE "out of memory|killed|fatal"

# Identifier les requêtes consommatrices
docker exec -it <POSTGRES_CONTAINER> psql --username=postgres --dbname=postgres \
  --command="SELECT pid, state, query_start, LEFT(query, 100) FROM pg_stat_activity WHERE state != 'idle' ORDER BY query_start;"
```

**Résolution** :

- **VPS sous-dimensionné** : si `free -h` montre une saturation chronique, augmentez la RAM côté provider (typiquement 4 → 8 Go).
- **Pas de swap** : configurez un swap minimal pour absorber les pics :
  ```bash
  # Sur l'instance ARC cible
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ```
- **Limite mémoire trop large pour Postgres** : par défaut, Postgres peut consommer toute la RAM disponible. Sur un VPS 8 Go, plafonnez-le à 2 Go pour laisser de la place aux autres services. Cela demande d'éditer le fichier de configuration de la stack `local-ai-packaged`, ce qui touche un fichier non géré par ARC :

  ```bash
  # Sur l'instance ARC cible — repérer le fichier
  find / -name "docker-compose.yml" -path "*local-ai-packaged*" 2>/dev/null
  # Éditer (sauvegardez avant !)
  cp <FILE_PATH> <FILE_PATH>.bak
  nano <FILE_PATH>
  # Sous le service `db:` (ou équivalent Postgres), ajoutez :
  #   mem_limit: 2g
  # Sauvegardez puis redémarrez la stack :
  docker compose --project-name local-ai-packaged up -d
  ```

  *Note : cette édition disparaîtra à la prochaine mise à jour de `local-ai-packaged` par `arc setup`. Une commande `arc tune postgres --mem=2g` (à venir) capturera ce besoin de manière idempotente.*

  *En attendant cette commande, sauvegardez votre modification dans un script local que vous relancerez après chaque update de la stack. Exemple : créez `~/arc-tunings.sh` contenant les commandes ci-dessus, et exécutez-le après chaque `arc setup --update`.*
- **Requête runaway** : tuez-la temporairement, puis demandez à l'app de la corriger :
  ```bash
  # Sur l'instance ARC cible — identifier le PID dans pg_stat_activity puis :
  docker exec -it <POSTGRES_CONTAINER> psql --username=postgres --dbname=postgres \
    --command="SELECT pg_terminate_backend(<PID>);"
  ```
- **Connexions trop nombreuses** : augmentez `max_connections` côté Postgres ou ajoutez un pooler (PgBouncer) — non couvert ici.

### §6.5 — Sandbox bloque le code agent

**Symptômes** :

- Une exécution de code agent (DeepAgents / OpenClaw) échoue avec `Connection refused`, `Permission denied`, ou `Read-only file system`.
- L'agent ne peut pas joindre Internet, ni d'autres services ARC.

**Important** : c'est très souvent **le comportement attendu**, pas un bug. La sandbox est conçue pour bloquer (cf. [ADR-0008](./03-architecture-decisions/0008-three-network-isolation.md) — réseau `sandbox_net` avec `internal: true`, FS read-only). Avant d'ouvrir, demandez-vous si le besoin de l'agent est légitime.

**Diagnostic** :

```bash
# Sur l'instance ARC cible — vérifier l'isolation actuelle
docker network inspect sandbox_net | grep -E "Internal|IPAM"
# "Internal": true confirme l'isolation Internet attendue

docker inspect arc-code-executor --format '{{.HostConfig.ReadonlyRootfs}}'
# true confirme le FS read-only attendu

# Test depuis le container sandbox — DOIT échouer
docker exec arc-code-executor sh -c 'ping -c1 8.8.8.8' 2>&1 || echo "Internet bloqué — comportement attendu"
docker exec arc-code-executor sh -c 'echo > /etc/hostname' 2>&1 || echo "FS read-only — comportement attendu"
```

**Résolution selon le besoin** :

- **L'agent doit appeler Ollama / Supabase locaux** : c'est légitime. Vérifiez que le container appartient bien au réseau de jonction `ai_net` en plus de `sandbox_net` (cf. ADR-0008 § "DeepAgents joint aussi sandbox_net") :

  ```bash
  # Sur l'instance ARC cible — vérifier les réseaux du container
  docker inspect <CONTAINER_NAME> --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
  # Attendu : "ai_net sandbox_net"
  ```

  S'il n'est que sur `sandbox_net`, l'ajout passe par l'édition du fichier `docker-compose.agents.yml` géré par ARC : sous le service concerné, ajoutez `ai_net` à la liste `networks:`. Puis :

  ```bash
  # Sur l'instance ARC cible
  docker compose -f /etc/arc/docker-compose.agents.yml up -d
  ```
- **L'agent doit lire un fichier persistant** : montez un volume **explicite** en `:rw` pour ce besoin précis, plutôt que de retirer `read_only: true` au container entier.
- **L'agent doit appeler Internet** : *en général c'est NON*. Si le besoin est légitime (ex : appeler une API LLM externe), créez un proxy applicatif côté `ai_net` (qui, lui, a accès Internet) que l'agent appelle, plutôt que d'ouvrir la sandbox. Ne modifiez **jamais** `internal: true` sur `sandbox_net` sans un ADR explicite.
- **Cas faux-positif (l'agent tape sur un service qui devrait être joignable mais ne l'est pas)** : vérifiez la résolution DNS interne Docker (`docker exec arc-code-executor nslookup ollama`), et que le service cible écoute bien (`docker exec ollama ss -tlnp`).
