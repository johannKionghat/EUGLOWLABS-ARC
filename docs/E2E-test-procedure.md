# E2E Test Procedure — EuglowLabs ARC Phase 1.5

Procédure pas-à-pas pour valider une installation ARC fraîche (post `arc setup --apply`) sur une VM/VPS Ubuntu 24.04 ou Debian 12. Compagnon de [`scripts/smoke-test.sh`](../scripts/smoke-test.sh).

**Cible** : utilisateur intermédiaire (connaît bash/ssh/docker basique). Liens externes pour les bases.

**Durée totale** : ~90 min (mandatory) à ~120 min (avec sections optionnelles DNS + backups runtime).

## Sommaire

1. [Prérequis](#1-prérequis-5-min) _(5 min)_
2. [Configuration des credentials](#2-configuration-des-credentials-10-min) _(10 min)_
3. [Installation initiale](#3-installation-initiale-mandatory-30-min) _(mandatory, 30 min)_
4. [Tests d'idempotence](#4-tests-didempotence-mandatory-10-min) _(mandatory, 10 min)_
5. [Tests runtime DNS](#5-tests-runtime-dns-optionnel-15-min) _(optionnel, 15 min)_
6. [Tests runtime backups](#6-tests-runtime-backups-optionnel-15-min) _(optionnel, 15 min)_
7. [Critères d'acceptation à cocher](#7-critères-dacceptation-5-min) _(5 min)_
8. [Cleanup post-test](#8-cleanup-post-test-5-min) _(5 min)_
9. [Troubleshooting](#9-troubleshooting)
10. [Annexe A — Commandes de référence](#annexe-a--commandes-de-référence-cheatsheet)

---

## 1. Prérequis _(5 min)_

- VM/VPS **Ubuntu 24.04** ou **Debian 12** — 8 Go RAM minimum, 60 Go disque
- Accès SSH avec sudo (clé recommandée, password avec sudo NOPASSWD toléré)
- Connectivité internet sortante (apt repos, GitHub raw, Docker Hub, Cloudflare R2)
- _(Optionnel — section 5)_ Compte Cloudflare avec zone DNS configurée + token `Zone:DNS:Edit`
- _(Optionnel — section 6)_ Compte Cloudflare R2 avec bucket + access keys + secret

### 1.1 Installer le CLI `arc`

```bash
# SSH sur la VM cible
ssh user@<VPS_IP>

# Installer arc via le one-liner (DIST-001 — pas de git clone)
curl -fsSL https://install-arc.euglowlabs.com | sh

# Vérifier l'installation
arc version
# arc v0.X.Y (sha=<short>, built=<ISO>)
```

Voir [`docs/installation.md`](installation.md) pour les variables d'environnement (`ARC_VERSION`, `ARC_INSTALL_DIR`) et le troubleshooting.

> **Débutant ?** Tutos externes :
> - SSH : <https://linuxize.com/post/how-to-use-ssh-to-connect-to-a-remote-server-in-linux-or-windows/>
> - sudo : <https://www.digitalocean.com/community/tutorials/how-to-edit-the-sudoers-file>
> - Docker basics : <https://docs.docker.com/get-started/>

---

## 2. Configuration des credentials _(10 min)_

### 2.1 Cloudflare DNS _(optionnel — saute si pas de Cloudflare)_

```bash
mkdir -p ~/.arc/credentials
chmod 700 ~/.arc/credentials
cat > ~/.arc/credentials/cloudflare.env <<'EOF'
CLOUDFLARE_API_TOKEN=<your-Zone:DNS:Edit-token>
CLOUDFLARE_ZONE_ID=<optional — fallback to auto-discovery>
EOF
chmod 600 ~/.arc/credentials/cloudflare.env
```

Génère un token avec scope `Zone:DNS:Edit` : <https://dash.cloudflare.com/profile/api-tokens>.

### 2.2 Cloudflare R2 _(optionnel — saute si pas de backups distants)_

```bash
cat > ~/.arc/credentials/r2.env <<'EOF'
ARC_R2_ACCESS_KEY_ID=<your-r2-access-key>
ARC_R2_SECRET_ACCESS_KEY=<your-r2-secret>
ARC_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
ARC_R2_BUCKET=arc-backup-<host>
ARC_R2_CRYPT_PASSWORD=<32+ chars random>
ARC_R2_CRYPT_SALT_PASSWORD=<32+ chars random>
EOF
chmod 600 ~/.arc/credentials/r2.env
```

Génère 32+ chars random : `openssl rand -base64 48`.

### 2.3 Ansible inventory _(mandatory)_

Le playbook tourne en `localhost` (ADR-0012). Aucun inventaire externe à configurer — vérification rapide :

```bash
which ansible-playbook   # doit retourner un chemin (apt install ansible si absent)
```

---

## 3. Installation initiale _(mandatory, 30 min)_

### 3.1 Premier run `arc setup --apply`

```bash
arc setup --apply
```

Durée typique : **10-15 min** (apt updates, Docker engine install, Coolify pull, ai-stack clone Supabase + Compose pull).

### 3.2 Vérification PLAY RECAP

À la fin du run, Ansible imprime un récap. Sortie attendue :

```
PLAY RECAP *********************************************************************
localhost                  : ok=N    changed=M   unreachable=0   failed=0    skipped=K   rescued=0   ignored=0
```

**Critères de succès** :
- `failed=0` (mandatory)
- `unreachable=0` (mandatory)
- `changed > 0` au premier run (système modifié)
- N ≈ 25-35 selon l'état initial de la cible

Si `failed > 0` → voir [§9.1 — Erreurs Ansible communes](#91-erreurs-ansible-communes).

### 3.3 Run `sudo bash scripts/smoke-test.sh`

```bash
sudo bash ~/euglowlabs-arc/scripts/smoke-test.sh
```

Durée : ~30 secondes (incluant le `docker run alpine ping` pour le test runtime sandbox_net).

### 3.4 Lecture du rapport

Sortie attendue :

```
===== Bootstrap & runtime context =====
  Hostname    : arc-vps-01
  Distribution: Ubuntu 24.04.x LTS
  arc_user    : ubuntu (home: /home/ubuntu)
  ...

===== Hardening — UFW =====
  ✓ UFW status active
  ✓ default deny incoming
  ...

[8 sections suivantes]

Summary: 38 passed, 0 failed, 1 warned
```

**Critères de succès** :
- `Summary: X passed, 0 failed` (mandatory)
- Warnings tolérés (ex: `r2.env` absent si tu n'as pas configuré R2 en §2.2)

Si `failed > 0` → l'opération qui a planté est dans le rapport. Voir [§9](#9-troubleshooting) pour les cas connus.

---

## 4. Tests d'idempotence _(mandatory, 10 min)_

### 4.1 Second run

Re-lance le playbook sans modifier la cible :

```bash
arc setup --apply
```

### 4.2 Validation `changed=0`

PLAY RECAP attendu :

```
PLAY RECAP *********************************************************************
localhost                  : ok=N    changed=0   unreachable=0   failed=0    skipped=K   rescued=0   ignored=0
```

**Critères de succès** :
- `changed=0` (mandatory — sinon les rôles ne sont pas idempotents, bug à reporter)
- `failed=0`

> **Exception attendue** : le rôle `ai-stack` peut reporter `changed=1` à chaque run car `start_services.py` upstream fait `down` puis `up` à chaque exécution. C'est connu (CLI gap noté en `tasks/completed/2026-05-07-ANSIBLE-001b.md`). Tolérable.

---

## 5. Tests runtime DNS _(optionnel, 15 min)_

_Saute si tu n'as pas configuré `~/.arc/credentials/cloudflare.env` en §2.1._

### 5.1 Round-trip add → list → dig → remove

```bash
# 1. Ajouter un record A test
arc dns add app.example.com --type A --content $(curl -s ifconfig.me)

# 2. Vérifier dans la liste Cloudflare
arc dns list --type A

# 3. Attendre la propagation DNS (~30-120 secondes)
dig +short app.example.com    # depuis ta machine ou la VM

# 4. Vérifier la collision detection (sans --force)
arc dns add app.example.com --type A --content 9.9.9.9    # DOIT planter avec message multi-line

# 5. Replace via --force
arc dns add app.example.com --type A --content 9.9.9.9 --force

# 6. Cleanup
arc dns remove app.example.com --type A
arc dns list --type A    # record absent
```

**Critères de succès** :
- `arc dns add` exit 0 + record visible dans Cloudflare dashboard
- `dig +short` retourne l'IP attendue
- `arc dns add` 2e fois sans `--force` → exit 1 + message multi-line avec 3 suggestions
- `--force` replace OK
- `arc dns remove` + `arc dns list` confirme l'absence

---

## 6. Tests runtime backups _(optionnel, 15 min)_

_Saute si tu n'as pas configuré `~/.arc/credentials/r2.env` en §2.2._

### 6.1 Trigger manuel du backup

```bash
sudo /usr/local/bin/arc-backup.sh
```

Durée : ~2-5 min (selon la taille de Coolify data + Postgres ai-stack).

Sortie attendue (extrait) :

```
=== ARC backup starting (20260508-...) ===
[1/6] Sync /opt/coolify/data → arc-r2-crypt:coolify-data
[2/6] Sync /home/ubuntu/.arc/credentials → arc-r2-crypt:credentials
[3/6] Snapshot state.json
[4/6] Using container: localai-db-1
[5/6] Cleanup local logs older than 30d
[6/6] Cleanup remote backups older than 30d
=== ARC backup completed ===
```

### 6.2 Vérification dans R2

```bash
sudo rclone ls arc-r2-crypt:                     # vue déchiffrée
# attendu : coolify-data/, credentials/, state/state-*.json, postgres/postgres-*.sql.gz

sudo rclone ls arc-r2:                           # vue chiffrée brute (filenames opaques — confirme l'encryption)
```

### 6.3 Procédure restore manuelle

```bash
# 1. Télécharger un backup Postgres récent
mkdir -p /tmp/restore-test
sudo rclone copy arc-r2-crypt:postgres/postgres-<TIMESTAMP>.sql.gz /tmp/restore-test/

# 2. Décompresser
gunzip /tmp/restore-test/postgres-*.sql.gz

# 3. (Test sécurisé — ne restore PAS sur la prod en place)
# Lancer un container Postgres jetable et restorer dedans :
docker run --rm -d --name pg-restore-test -e POSTGRES_PASSWORD=tmp -p 55432:5432 postgres:15
sleep 5
docker exec -i pg-restore-test psql -U postgres < /tmp/restore-test/postgres-*.sql

# 4. Vérifier
docker exec pg-restore-test psql -U postgres -c '\l'    # liste les DB restaurées
docker stop pg-restore-test
```

**Critères de succès** :
- `arc-backup.sh` exit 0
- 4 sources visibles dans `rclone ls arc-r2-crypt:` (coolify-data, credentials, state, postgres)
- Filenames opaques côté `arc-r2:` (encryption confirmée)
- Restore Postgres dans container jetable produit une liste DB cohérente

---

## 7. Critères d'acceptation _(5 min)_

Coche au fur et à mesure pour traçabilité du run.

### Hardening (10 critères)
- [ ] UFW actif (`ufw status verbose` → `Status: active`)
- [ ] UFW autorise 22 (ou `ARC_SSH_PORT`) + 80 + 443
- [ ] UFW default deny incoming, allow outgoing
- [ ] **Port 8000 NON exposé** (Q6 ANSIBLE-001a — Coolify localhost-only)
- [ ] IPv6 enabled (`/etc/default/ufw` → `IPV6=yes`)
- [ ] fail2ban service actif
- [ ] fail2ban jails `sshd` + `recidive` enabled
- [ ] sshd `PasswordAuthentication no` (drop-in `/etc/ssh/sshd_config.d/99-arc.conf`)
- [ ] sshd `PermitRootLogin prohibit-password` ou `no`
- [ ] unattended-upgrades actif (security-only, no auto-reboot)

### Docker + Networks ADR-0008 (5 critères)
- [ ] docker engine actif, compose v2 plugin
- [ ] `arc_user` dans le groupe docker
- [ ] 3 networks ARC présents (`prod_net`, `ai_net`, `sandbox_net`)
- [ ] `sandbox_net` `internal: true` (config + runtime ping FAIL)
- [ ] Labels `arc.network` / `arc.role` / `arc.managed-by=ansible` posés

### Coolify + ai-stack (5 critères)
- [ ] Coolify répond `localhost:8000` (200/302/401)
- [ ] Supabase Kong répond `localhost:8001` (Kong remappé pour éviter collision 8000)
- [ ] Ollama API répond `localhost:11434/api/version` (200)
- [ ] `docker compose -p localai ps` montre les services Supabase + ai
- [ ] `~/.arc/credentials/local-ai.env` présent (mode 0600, owned par `arc_user`)

### Backups (5 critères)
- [ ] `/usr/local/bin/arc-backup.sh` présent (mode 0750)
- [ ] `/etc/cron.d/arc-backup` présent (cron daily 3am)
- [ ] `/root/.config/rclone/rclone.conf` présent (mode 0600)
- [ ] _(Si R2 configuré)_ Backup manuel succeed → fichiers chiffrés visibles via `rclone ls arc-r2-crypt:`
- [ ] _(Si R2 configuré)_ Restore manuel d'1 backup vers container Postgres jetable → liste DB cohérente

### DNS (3 critères, optionnels si pas de Cloudflare)
- [ ] _(Si token)_ `arc dns add` puis `arc dns list` → record visible côté Cloudflare
- [ ] _(Si token)_ `dig +short` resolve depuis internet (post-propagation)
- [ ] _(Si token)_ Round-trip `add → list → remove → list (absent)` + collision detection sans `--force`

### Smoke humain global
- [ ] `sudo bash scripts/smoke-test.sh` → 0 failed (warnings tolérés)
- [ ] Idempotence : second run `arc setup --apply` → `changed=0` (exception ai-stack tolérée)

---

## 8. Cleanup post-test _(5 min)_

Si la VM était jetable :

```bash
# Sur Cloudflare (si tu as testé section 5)
arc dns remove app.example.com --type A    # ou via dashboard

# Si tu as utilisé R2 pour le test : objet bucket conservé pour archive,
# ou flush manuel : sudo rclone delete arc-r2-crypt: --min-age 0d

# Démontage VPS : depuis le dashboard fournisseur (Hetzner/OVH/Scaleway/etc.)
# OU via Terraform : terraform destroy
```

Si tu gardes la VM pour usage continu : **rotate les tokens de test** (Cloudflare API token + R2 access keys) pour éviter qu'ils ne traînent.

---

## 9. Troubleshooting

### 9.1 Erreurs Ansible communes

**`sudo: a password is required`**
- Cause : sudo sans NOPASSWD + Ansible sans TTY
- Fix : `echo "<user> ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/arc-ansible` (ATTENTION : sécurité — réservé aux VMs jetables)

**`fail2ban-client status` retourne « No such jail »**
- Cause : fail2ban a banni l'IP de l'admin pendant le run (rare mais arrivé)
- Fix : `sudo fail2ban-client set sshd unbanip <YOUR_IP>` depuis le serveur (console fournisseur si SSH coupé)

**`apt update` échoue sur le repo Docker**
- Cause : proxy entreprise ou DNS local intercepté
- Fix : `curl -fsSL https://download.docker.com/linux/ubuntu/gpg` doit retourner la clé GPG. Sinon, vérifie le proxy / DNS résolution.

### 9.2 Healthchecks HTTP qui foirent

**Coolify ne répond pas sur `localhost:8000`**
- Cause typique : Postgres init pas terminé (~5 min sur petit VPS)
- Diagnostic : `docker compose -f /opt/coolify/docker-compose.yml ps` — tous les services doivent être `Up (healthy)`
- Fix : attendre 5 min de plus, retry. Si > 10 min : `docker compose -f /opt/coolify/docker-compose.yml logs --tail 100`

**Supabase Kong retourne 502 sur `localhost:8001`**
- Cause : Kong démarré avant Postgres prêt
- Diagnostic : `docker compose -p localai logs kong --tail 50`
- Fix : redémarrer le stack ai : `cd /opt/local-ai && sudo python3 start_services.py --profile cpu --environment private`

**Ollama timeout sur `/api/version`**
- Cause : premier appel charge le modèle par défaut (peut prendre 30-60s)
- Fix : retry après 1 min ; si toujours timeout : `docker compose -p localai logs ollama-cpu --tail 50`

### 9.3 Backup silent fail

**`arc-backup.sh` exit 0 mais aucun fichier dans R2**
- Cause typique : `r2.env` mal formaté (espaces autour de `=`, quotes inutiles)
- Diagnostic : `cat ~/.arc/credentials/r2.env | od -c | head` — vérifier l'absence de `\r`, espaces, `'` ou `"`
- Fix : reformatter strictement `KEY=VALUE` sans espaces, mode 0600, puis `sudo /usr/local/bin/arc-backup.sh`

**`rclone obscure` n'a pas été appliqué (passwords plain dans rclone.conf)**
- Cause : ancien run du rôle `backups` quand `r2.env` était vide
- Diagnostic : `sudo cat /root/.config/rclone/rclone.conf` — `password = ...` doit ressembler à du base64 obscurci, pas le password en clair
- Fix : `sudo rm /root/.config/rclone/rclone.conf` puis `arc setup --apply` re-template avec obscure

**Container Postgres pas trouvé via labels**
- Cause : `local-ai-packaged` upstream a changé la convention de naming
- Diagnostic : `docker ps --filter label=com.docker.compose.project=localai` — vérifier que `db` apparaît
- Fix : si labels manquants, ajuster `arc-backup.sh` ou bumper le SHA pinné `arc_local_ai_version`

---

## Annexe A — Commandes de référence (cheatsheet)

### UFW (firewall)
```bash
sudo ufw status verbose          # statut + règles complètes
sudo ufw status numbered         # règles numérotées (utile pour delete)
sudo ufw allow <PORT>/tcp        # ouvrir un port
sudo ufw delete <NUMBER>         # supprimer une règle par numéro
```

### fail2ban
```bash
sudo fail2ban-client status                 # vue d'ensemble (jails actifs)
sudo fail2ban-client status sshd            # détail jail sshd (banlist)
sudo fail2ban-client set sshd unbanip <IP>  # débanner une IP
sudo journalctl -u fail2ban -n 50           # logs récents
```

### SSH
```bash
sudo sshd -t                                          # valide la conf
sudo cat /etc/ssh/sshd_config.d/99-arc.conf           # ARC drop-in
sudo systemctl reload ssh                             # reload sans déconnexion
```

### Docker
```bash
docker ps                                                          # containers actifs
docker network ls --filter label=arc.managed-by=ansible            # ARC networks only
docker network inspect sandbox_net | jq '.[0].Internal'            # confirm Internal:true
docker logs <container_name> --tail 100                            # logs container
```

### Docker Compose (Coolify + ai-stack)
```bash
docker compose -p localai ps                                       # ai-stack services
docker compose -p localai -f /opt/local-ai/supabase/docker/docker-compose.yml logs db --tail 50
docker compose -f /opt/coolify/docker-compose.yml ps               # Coolify services
```

> ⚠️ **CLI gap** : le path `/opt/coolify/docker-compose.yml` est correct selon le rôle Ansible coolify ; à reconfirmer au runtime E2E réel (cas confusion compose racine vs `/source` selon les versions Coolify).

### Backups (rclone + script)
```bash
sudo /usr/local/bin/arc-backup.sh                # trigger manuel
sudo rclone listremotes --config /root/.config/rclone/rclone.conf
sudo rclone ls arc-r2-crypt:                     # vue déchiffrée des backups
sudo rclone ls arc-r2:                           # vue chiffrée brute (filenames opaques)
sudo tail -f /var/log/arc/backup-*.log           # logs script
```

### CLI ARC (DNS)
```bash
arc dns list --json                                                  # records actuels (machine-readable)
arc dns add app.example.com --type A --content 1.2.3.4 --dry-run    # preview
arc dns add app.example.com --type A --content 1.2.3.4              # réel
arc dns remove app.example.com --type A
```

### Logs système ARC
```bash
sudo journalctl -u docker -n 100                 # docker engine
sudo journalctl -u fail2ban -n 100               # fail2ban
sudo journalctl -u ssh -n 100                    # sshd
sudo tail -f /var/log/arc/backup-*.log           # backup script
sudo tail -f /var/log/arc/cron.log               # cron arc-backup output
```
