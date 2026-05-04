# Installer ARC sans IP publique

> **Objectif** : permettre à un utilisateur d'installer EuglowLabs ARC sur une machine **sans IP publique** (Raspberry Pi à la maison, machine WSL2, NAS auto-hébergé, serveur derrière un NAT d'entreprise) en utilisant un tunnel Cloudflare comme pivot.
>
> Ce document mitige le compromis P3 acté dans [ADR-0012](./03-architecture-decisions/0012-single-machine-install.md) : la suppression du tunnel Cloudflare géré par le CLI signifiait perdre ce cas d'usage, ce guide le restaure en mode **manuel et explicite**.

> 📌 **Prérequis version** : ce guide assume qu'INSTALL-001 (commande `arc setup`) est livrée. Si vous lisez ce guide **avant** cette livraison, suivez les sections 1–5 (configuration cloudflared) ; la section 6 deviendra applicable une fois INSTALL-001 livré. Voir [`tasks/INDEX.md`](../tasks/INDEX.md) pour le statut de la livraison.

## 1. À qui s'adresse ce guide

Vous êtes au bon endroit si votre machine cible se trouve dans **un réseau qui ne peut pas recevoir de connexions Internet entrantes**. Quatre cas concrets :

- **Raspberry Pi à la maison**, derrière la box de votre FAI (NAT, pas de port forwarding configuré ou impossible).
- **Machine WSL2 sur Windows**, qui partage l'IP du PC hôte sans port mapping persistant.
- **NAS auto-hébergé** (Synology, QNAP, Unraid) sur lequel vous voulez tourner ARC en parallèle des services existants.
- **Serveur dans un réseau d'entreprise** où le port 80/443 entrant est bloqué par la politique IT.

> 🏠 **Vous avez une IP publique sur votre VPS (OVH, Hetzner, Scaleway, AWS…) ?** Ce guide n'est pas pour vous. Lancez directement `arc setup` sur votre VPS, puis voyez [`migration-guide.md`](./migration-guide.md) pour migrer vos projets.

**Le pivot technique** : nous allons installer `cloudflared` (le client tunnel de Cloudflare) sur votre machine cible. Il établit une connexion **sortante** vers le réseau Cloudflare, et c'est Cloudflare qui expose vos services à Internet via vos sous-domaines. Pas besoin d'IP publique, pas besoin de port forwarding, pas besoin de toucher au routeur.

*Pensez `cloudflared` comme **un ngrok permanent + un DNS managé** : il fait le pont entre Internet et votre machine sans que la machine soit directement joignable.*

> **Alternative non couverte ici** : [Tailscale Funnel](https://tailscale.com/kb/1223/funnel) offre un mécanisme similaire avec une approche réseau mesh privé. Si vous l'utilisez déjà, ARC fonctionnera derrière sans modification du CLI, mais la procédure n'est pas documentée actuellement — ouvrez une issue GitHub si vous en avez besoin.

## 2. Prérequis

Avant de commencer, vérifiez :

**Côté matériel / OS sur la machine cible** :
- Architecture supportée : `amd64` (PC standard, x86_64) ou `arm64` (Raspberry Pi 4+, Apple Silicon, AWS Graviton). Les Pi plus anciens en `armhf` fonctionnent aussi mais sont sous-dimensionnés.
- Au moins **2 vCPU** et **4 Go RAM** disponibles. ARC tourne mais avec une marge tendue ; 8 Go est plus confortable.
- Au moins **40 Go de disque libre**.
- SSH activé et accessible **depuis votre poste local** (sur le réseau local suffit, pas besoin d'exposition Internet).
- Accès root ou `sudo`.

**Côté Cloudflare** :
- Un compte Cloudflare (le plan gratuit suffit pour l'usage standard).
- Un nom de domaine `<DOMAIN>` (ex : `mondomaine.com`) **dont les DNS sont gérés par Cloudflare** (les nameservers doivent pointer chez Cloudflare). Si ce n'est pas le cas, transférez d'abord la gestion DNS chez Cloudflare avant de continuer.

**Compréhension à acquérir** :
- *NAT* (Network Address Translation) = mécanisme qui partage une IP publique entre plusieurs machines d'un réseau local. C'est ce qui empêche votre RPi d'être joignable directement depuis Internet.
- *Port forwarding* = configuration côté routeur qui crée une exception pour rediriger un port externe vers une machine interne. On contourne ce besoin avec cloudflared.
- *Connexion sortante uniquement* = votre machine cible **émet** des connexions vers Cloudflare ; Cloudflare ne se connecte jamais directement à elle. C'est ce qui rend le système compatible avec n'importe quel NAT.

## 3. TL;DR pour devs avancés

```bash
# Sur la machine cible — install cloudflared (cf. §4.1)
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared

# Sur la machine cible — auth + create tunnel
cloudflared tunnel login         # OAuth Cloudflare
cloudflared tunnel create arc    # produit <TUNNEL_ID> + ~/.cloudflared/<TUNNEL_ID>.json

# Sur la machine cible — routes DNS pour chaque sous-domaine ARC
for SUB in coolify dashboard agents n8n supabase chat flowise langfuse status openclaw; do
  cloudflared tunnel route dns <TUNNEL_ID> $SUB.<DOMAIN>
done

# Sur la machine cible — config ingress dans ~/.cloudflared/config.yml (cf. §4.5)
# puis démarrage en service systemd :
sudo cloudflared service install
sudo systemctl enable --now cloudflared

# Sur la machine cible — puis :
arc setup    # cf. §6 — dépend de INSTALL-001
```

## 4. Installation et configuration de cloudflared

### 4.1 — Installer `cloudflared`

Procédure selon votre OS / distribution sur la **machine cible** :

```bash
# Sur la machine cible — Ubuntu / Debian / Raspberry Pi OS
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared
```

```bash
# Sur la machine cible — WSL2 (Ubuntu) — même procédure que ci-dessus, marche tel quel
```

```bash
# Sur la machine cible — installation manuelle binaire (toute distrib Linux)
# Récupérez l'URL adaptée à votre architecture sur https://github.com/cloudflare/cloudflared/releases/latest
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-<ARCH>.deb
sudo dpkg -i cloudflared.deb
# Remplacez <ARCH> par : amd64, arm64, armhf selon votre machine.
```

Vérifiez :

```bash
# Sur la machine cible
cloudflared --version
# Attendu : "cloudflared version 2024.x.x" ou plus récent
```

### 4.2 — Authentifier `cloudflared` auprès de votre compte Cloudflare

```bash
# Sur la machine cible
cloudflared tunnel login
```

*Cette commande affiche une URL Cloudflare. Copiez-la et ouvrez-la dans le navigateur de votre poste local (la machine cible n'a pas forcément de navigateur). Connectez-vous, sélectionnez votre zone `<DOMAIN>`, validez. Cloudflared télécharge automatiquement un certificat dans `~/.cloudflared/cert.pem`. C'est un OAuth standard, comme `vercel login` ou `gh auth login`.*

### 4.3 — Créer le tunnel

```bash
# Sur la machine cible
cloudflared tunnel create arc
```

La commande produit deux choses :

- Un identifiant `<TUNNEL_ID>` (UUID, ex : `f5b2c1d8-9a4e-4b3f-9c8a-7e2d6b1f4a0d`). **Notez-le**, vous en aurez besoin partout par la suite.
- Un fichier `~/.cloudflared/<TUNNEL_ID>.json` qui contient la **clé privée** du tunnel. C'est avec ce fichier que `cloudflared` s'authentifie à Cloudflare au démarrage du tunnel.

> 🛡️ **Sécurité — protégez ce fichier** :
>
> ```bash
> # Sur la machine cible
> chmod 600 ~/.cloudflared/<TUNNEL_ID>.json
> ```
>
> *Quiconque a ce fichier peut faire passer du trafic via votre tunnel. Ne le committez jamais dans Git, ne le partagez jamais.*

### 4.4 — Créer les routes DNS pour chaque service ARC

Chaque service de la stack ARC a son propre sous-domaine. On les attache au tunnel via la commande `cloudflared tunnel route dns`. Cela crée automatiquement un record CNAME chez Cloudflare pointant vers le tunnel.

```bash
# Sur la machine cible — services Niveau 1 (Chantier 1)
cloudflared tunnel route dns <TUNNEL_ID> coolify.<DOMAIN>
cloudflared tunnel route dns <TUNNEL_ID> dashboard.<DOMAIN>
cloudflared tunnel route dns <TUNNEL_ID> agents.<DOMAIN>
cloudflared tunnel route dns <TUNNEL_ID> supabase.<DOMAIN>
cloudflared tunnel route dns <TUNNEL_ID> n8n.<DOMAIN>
cloudflared tunnel route dns <TUNNEL_ID> chat.<DOMAIN>
cloudflared tunnel route dns <TUNNEL_ID> flowise.<DOMAIN>
cloudflared tunnel route dns <TUNNEL_ID> langfuse.<DOMAIN>
cloudflared tunnel route dns <TUNNEL_ID> status.<DOMAIN>
cloudflared tunnel route dns <TUNNEL_ID> openclaw.<DOMAIN>
```

Pour vos **projets utilisateur** (apps que vous déploierez via Coolify), deux options :

**Option simple — un sous-domaine par projet, déclaré explicitement** : refaites un `cloudflared tunnel route dns` par sous-domaine. Adapté si vous avez peu de projets et savez à l'avance lesquels.

**Option flexible — wildcard** : `cloudflared` ne supporte pas nativement les routes DNS wildcard, mais Cloudflare le permet côté DNS. Créez manuellement un record CNAME `*.<DOMAIN>` pointant vers `<TUNNEL_ID>.cfargotunnel.com` :

1. Cloudflare dashboard → votre zone `<DOMAIN>` → DNS → **Add record**.
2. Type : `CNAME`. Name : `*`. Target : `<TUNNEL_ID>.cfargotunnel.com`. Proxy status : **Proxied** (orange).

⚠️ **Dépendance critique** : le CNAME wildcard ne fonctionne **que si** votre `~/.cloudflared/config.yml` contient aussi une règle ingress wildcard `"*.<DOMAIN>"` (cf. §4.5). Sans cette règle YAML, vos sous-domaines non listés explicitement tomberont en 404 même avec le CNAME en place. Vérifiez ce point avant de débugger 1 h.

Vérifiez :

```bash
# Sur votre poste local
dig +short coolify.<DOMAIN>
# Attendu : adresse IP Cloudflare (ex : 104.21.x.x ou 172.67.x.x)
```

### 4.5 — Configurer les règles d'ingress dans `~/.cloudflared/config.yml`

Le fichier `config.yml` indique à `cloudflared` comment router chaque sous-domaine vers le bon service local.

D'abord, identifiez les ports réellement exposés par les services ARC sur votre machine — ils dépendent de la version de la stack `local-ai-packaged` et de la config Coolify :

```bash
# Sur la machine cible — lister les ports exposés par les services ARC
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

*Les ports varient selon la version de `local-ai-packaged` et la config Coolify ; aucune valeur par défaut n'est garantie. Utilisez la commande `docker ps` ci-dessus pour récupérer les valeurs réelles sur votre machine.*

Dans la sortie, repérez les ports correspondant à chaque service :

- `<COOLIFY_PORT>`
- `<DASHBOARD_PORT>`
- `<AGENT_PORT>`
- `<SUPABASE_KONG_PORT>`
- `<N8N_PORT>`
- `<OPEN_WEBUI_PORT>`
- `<FLOWISE_PORT>`
- `<LANGFUSE_PORT>`
- `<UPTIME_KUMA_PORT>`
- `<OPENCLAW_PORT>`

Créez ou éditez le fichier :

```bash
# Sur la machine cible
nano ~/.cloudflared/config.yml
```

Contenu (à adapter avec vos valeurs `<TUNNEL_ID>` et `<DOMAIN>`) :

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/<YOUR_USER>/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: coolify.<DOMAIN>
    service: http://localhost:<COOLIFY_PORT>
  - hostname: dashboard.<DOMAIN>
    service: http://localhost:<DASHBOARD_PORT>
  - hostname: agents.<DOMAIN>
    service: https://localhost:<AGENT_PORT>
    originRequest:
      noTLSVerify: true   # l'Agent expose un cert auto-signé en local
  - hostname: supabase.<DOMAIN>
    service: http://localhost:<SUPABASE_KONG_PORT>
  - hostname: n8n.<DOMAIN>
    service: http://localhost:<N8N_PORT>
  - hostname: chat.<DOMAIN>
    service: http://localhost:<OPEN_WEBUI_PORT>
  - hostname: flowise.<DOMAIN>
    service: http://localhost:<FLOWISE_PORT>
  - hostname: langfuse.<DOMAIN>
    service: http://localhost:<LANGFUSE_PORT>
  - hostname: status.<DOMAIN>
    service: http://localhost:<UPTIME_KUMA_PORT>
  - hostname: openclaw.<DOMAIN>
    service: http://localhost:<OPENCLAW_PORT>
  # Wildcard projets utilisateur — toutes les apps Coolify sortent sur le port 80
  - hostname: "*.<DOMAIN>"
    service: http://localhost:80
  # Catch-all obligatoire en fin de liste
  - service: http_status:404
```

*Lecture du fichier : chaque entrée `ingress` matche un hostname et le route vers un service local. La dernière entrée (sans `hostname`) est obligatoire — elle attrape tout le reste et renvoie un 404. Sans elle, `cloudflared` refuse de démarrer.*

⚠️ **Erreurs courantes** :
- Les ports doivent être ceux **vus depuis la machine hôte**, pas ceux internes au container Docker. La commande `docker ps` ci-dessus affiche le mapping `<HOST_PORT>:<CONTAINER_PORT>` — c'est le `<HOST_PORT>` qu'on utilise.
- Le wildcard `"*.<DOMAIN>"` doit être entre guillemets dans YAML, sinon il est interprété comme une ancre.
- L'entrée `originRequest: noTLSVerify: true` pour `agents.<DOMAIN>` est nécessaire parce que l'ARC Agent expose son endpoint en TLS auto-signé en local. C'est sécurisé tant que la connexion `cloudflared → localhost` reste sur la machine, mais à revoir si un jour l'Agent exposait un certif valide.

### 4.6 — Note sécurité : rotation du token tunnel

La clé privée du tunnel (`~/.cloudflared/<TUNNEL_ID>.json`) ne change pas par elle-même. En cas de compromission suspectée, la procédure de rotation **n'est pas triviale et n'est pas documentée ici** : elle implique de créer un nouveau tunnel, de mettre à jour les CNAME chez Cloudflare, et de migrer la config — un risque de downtime non géré.

> 📝 **À documenter** dans une procédure dédiée si la demande remonte. En attendant, si vous suspectez une compromission : créez un nouveau tunnel (`cloudflared tunnel create arc-v2`), recréez les routes DNS dessus, mettez à jour `config.yml`, redémarrez le service. L'ancien tunnel peut être supprimé avec `cloudflared tunnel delete arc`.

## 5. Démarrer le tunnel comme service systemd

Démarrer manuellement avec `cloudflared tunnel run` fonctionne pour un test, mais le tunnel s'arrête à la déconnexion SSH. Pour un usage durable, on l'installe en service systemd.

> ℹ️ **Spécifique WSL2** : systemd n'est activé sur WSL2 qu'à partir de WSL 2.0+ et nécessite `systemd=true` dans `/etc/wsl.conf`. Vérifiez avec :
>
> ```bash
> # Sur la machine cible
> systemctl --version
> ```
>
> Si la commande échoue avec `System has not been booted with systemd as init system`, éditez `/etc/wsl.conf`, ajoutez :
>
> ```ini
> [boot]
> systemd=true
> ```
>
> Puis dans PowerShell : `wsl --shutdown`, relancez WSL. Doc Microsoft : <https://learn.microsoft.com/windows/wsl/systemd>
>
> Alternative sans systemd (containers minimaux, vieux RPi) : lancement via `nohup` ou `tmux` — non couvert ici, ouvrez une issue GitHub.


```bash
# Sur la machine cible
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

Vérifiez que le service tourne :

```bash
# Sur la machine cible
sudo systemctl status cloudflared
journalctl -u cloudflared -f
# Vous devriez voir des lignes comme : "Connection registered with location SFO" — le tunnel est UP.
# Ctrl+C pour quitter le tail des logs.
```

Test depuis l'extérieur :

```bash
# Sur votre poste local
curl -I https://coolify.<DOMAIN>
# Attendu : 200 (ou 301/302) avec un certificat Cloudflare valide
```

> ℹ️ **Différence avec le tunnel ARC Agent ↔ Dashboard** — à ne pas confondre :
>
> - **Tunnel cloudflared documenté ici** : il expose vos services ARC à **Internet** (trafic entrant Internet → tunnel → services locaux). C'est ce que vous configurez dans ce guide pour qu'un visiteur puisse atteindre votre instance depuis l'extérieur.
> - **Tunnel Cloudflare ARC Agent ↔ Dashboard** mentionné dans ADR-0012 : c'est une connexion privée bidirectionnelle entre votre instance ARC Agent et le Dashboard, conçue pour les futurs usages multi-VPS / Cloud (Chantier 2). **Non documenté ici, pas en Chantier 1.**
>
> Les deux portent le nom "tunnel Cloudflare" parce qu'ils utilisent la même brique technique, mais ils servent des objectifs différents et coexistent sans interférence sur la même machine.

## 6. Lancer `arc setup` derrière le tunnel

> ⏳ **Cette section dépend d'INSTALL-001** (en cours, cf. [`tasks/INDEX.md`](../tasks/INDEX.md)). La commande exacte de désactivation DNS dans `arc setup` sera documentée une fois INSTALL-001 livré. En attendant, lancez `arc setup` lorsqu'il sera disponible et choisissez l'option qui désactive la création automatique de records DNS — les CNAMEs sont déjà en place via cloudflared.

Maintenant que les services sont joignables via Cloudflare, lancez l'installation ARC. Notez que `arc setup` crée normalement les records DNS via l'API Cloudflare ; ici, comme `cloudflared` les a déjà créés en CNAME, vous pouvez désactiver cette étape.

À la question du domaine, indiquez votre `<DOMAIN>` Cloudflare. À la question du provider DNS, vous pouvez laisser vide (les CNAMEs sont déjà en place).

### Vérification post-install

```bash
# Sur votre poste local
curl -I https://coolify.<DOMAIN>
curl -I https://dashboard.<DOMAIN>
curl -I https://supabase.<DOMAIN>
```

Tous doivent retourner 200 (ou 301/302) avec certificat Cloudflare valide. Ouvrez `https://coolify.<DOMAIN>` dans votre navigateur pour finaliser le setup admin de Coolify.

### Cas particulier — Let's Encrypt derrière tunnel

Avec un tunnel cloudflared en mode **proxied**, le terminating SSL est géré **par Cloudflare**, pas par votre instance ARC. Conséquences à valider empiriquement sur votre setup :

- **Hypothèse principale** : Coolify ne devrait pas avoir besoin d'émettre ses propres certificats Let's Encrypt pour les sous-domaines exposés via le tunnel — Cloudflare présente déjà un certificat "Universal SSL" valide automatiquement.
- **Si Coolify tente quand même d'émettre un certificat Let's Encrypt et échoue** (le challenge HTTP-01 ne passe pas à travers le tunnel selon la config) : désactivez l'émission Let's Encrypt côté Coolify, ou activez le mode "Flexible" / "Full" SSL côté Cloudflare pour que la chaîne se ferme.
- **Vérification empirique** : `curl -vI https://coolify.<DOMAIN> 2>&1 | grep -E "(issuer|subject)"` doit montrer un certificat émis par Cloudflare ou Let's Encrypt — pas un cert auto-signé.

> ⚠️ **Cette section est basée sur le comportement attendu de cloudflared 2024+ ; si votre déploiement diverge, signalez-le via une issue GitHub. Pas de doc inventée — la procédure exacte sera figée après E2E-001.**

---

## Et après ?

Une fois ARC installé et accessible via votre tunnel, vous pouvez **migrer un projet existant** depuis Vercel ou un autre hébergement : voir [`migration-guide.md`](./migration-guide.md). Toute la procédure de migration s'applique sans modification — votre instance ARC est joignable comme n'importe quel VPS du point de vue des outils de migration.
