# SPEC TECHNIQUE — Infrastructure Self-Hosted Multi-Projets

| Champ | Valeur |
|---|---|
| **Version** | 2.0 |
| **Date** | Mai 2026 |
| **Auteur** | Johann |
| **Statut** | Draft → Implémentation |
| **Cible** | Dev local (WSL2) → Migration VPS Hetzner, via CLI unifié |
| **Périmètre** | EuglowLabs, InfinixUI, InfinixLoop, EduMatch + agents AI + sandbox |

> **Changements v2.0** : ajout du CLI d'automatisation (§5), du mode dual local/VPS unifié (§6), identification des outils open-source qui couvrent ~80% du périmètre (§4), refonte de la roadmap (§17).

---

## 1. Contexte & Objectifs

### 1.1 Problème actuel
Hébergement réparti sur Vercel (frontends) + Supabase (BDD), atteignant rapidement les limites des plans gratuits. Le passage à Vercel Pro + Supabase Pro représente **45–95 €/mois minimum**, avec des coûts variables sur le stockage, l'egress et le compute. Plusieurs projets en parallèle multiplient cette charge.

### 1.2 Objectifs de l'infrastructure
- **Centraliser** tous les projets (web apps, BDD, automatisations) sur une infra unique.
- **Réduire le coût mensuel** à un montant fixe et prévisible.
- **Garantir la portabilité** : migration d'une machine à une autre en < 30 minutes, sans perte de données.
- **Isoler** les environnements production / IA / sandbox pour la sécurité.
- **Self-host** les LLMs et agents AI (Ollama, OpenClaw, DeepAgents).
- **Garder un workflow Git push → deploy** équivalent à Vercel.
- **Automatiser le bootstrap complet** via une seule commande CLI (v2.0).
- **Workflow identique en local et sur VPS** — même config, mêmes domaines (v2.0).

### 1.3 Non-objectifs
- Haute disponibilité multi-zone (single VPS suffisant en phase 1).
- Auto-scaling horizontal (scaling vertical via resize Hetzner suffit).
- Kubernetes (Docker Compose + Coolify suffisent à cette échelle).

---

## 2. Décisions d'architecture

### 2.1 Hébergement : VPS dès la mise en production
| Critère | Mini PC perso | VPS Hetzner |
|---|---|---|
| Coût initial | 300–500 € | 0 € |
| Uptime | Dépend connexion / élec | 99.9 % SLA |
| Scalabilité | Bloqué matériel | Resize à chaud |
| Coût mensuel | 0 € + élec | 6–13 € |

**Décision : VPS Hetzner CX32** (~6,52 €/mois, 4 vCPU, 8 Go RAM, 80 Go NVMe). Phase de dev/test en local sur WSL2 avec **mêmes commandes et même config** grâce au CLI (§5).

### 2.2 Orchestrateur : Coolify (par défaut) ou Dokploy
Coolify remplace Vercel : deploy Git push, SSL auto via Let's Encrypt, gestion des env vars, UI complète. Open-source MIT, intègre Traefik nativement.

| Critère | Coolify | Dokploy |
|---|---|---|
| RAM idle | 500–700 Mo | ~350 Mo |
| CPU idle | 5–6 % | ~0,8 % |
| UI | Plus polie, plus de features | Plus simple, plus léger |
| Docker Compose | Support natif | Support natif |
| GitHub stars | ~50k+ | ~26k+ |

Le CLI permet de choisir l'un ou l'autre au moment de l'init. Coolify par défaut (plus de features), Dokploy si VPS contraint en RAM.

### 2.3 Conteneurs : Docker Compose
Chaque projet = un `docker-compose.yml` versionné dans Git. Migration = `docker compose up` sur n'importe quelle machine + restore d'un dump SQL. **Pas de perte de données** : les volumes Docker sont sauvegardés et restaurés indépendamment.

### 2.4 BDD : PostgreSQL via Supabase self-hosted
Le bundle `local-ai-packaged` (cf. §4) inclut Supabase complet (Postgres + Auth + Storage + Studio + pgvector). Une instance pour tous les projets, une database par projet.

### 2.5 Stack IA : `local-ai-packaged` comme base
Le repo open-source `coleam00/local-ai-packaged` couvre déjà ~80 % du périmètre IA prévu : Ollama + Supabase + n8n + Open WebUI + Qdrant + Neo4j + Flowise + Langfuse + SearXNG + Caddy. Le CLI le déploie comme ressource Coolify et y ajoute OpenClaw, DeepAgents et la sandbox isolée.

---

## 3. Topologie réseau

L'infra est segmentée en **3 réseaux Docker isolés**. Les flux entre réseaux ne passent que par des points autorisés explicitement.

| Réseau | Couleur | Internet | Vers autres réseaux | Rôle |
|---|---|---|---|---|
| `prod_net` | 🟢 Vert | ✅ Oui | → `ai_net` (lecture) | Apps en production |
| `ai_net` | 🔵 Bleu | ✅ Oui (APIs externes) | → `sandbox_net` | LLMs & agents AI |
| `sandbox_net` | 🔴 Rouge | ❌ `internal: true` | Aucun | Exécution code isolée |

### 3.1 Schéma des flux
```
Internet
   │
   ▼
[Traefik :80/:443] ── prod_net ──► Apps Next.js + n8n + PostgreSQL + Supabase Studio
                                          │
                                          ▼ (appels API uniquement)
                                    ai_net ──► Ollama + OpenClaw + DeepAgents
                                                       │
                                                       ▼ (exécution code généré)
                                                 sandbox_net ──► Code Executor (read-only, sans internet)
```

### 3.2 Règles de routage
- Seul Traefik est exposé sur le port public (80/443).
- Aucun service interne (PostgreSQL, Ollama) n'expose de port public.
- `sandbox_net` est marqué `internal: true` : pas d'accès internet, pas d'accès aux autres réseaux.

---

## 4. Inventaire des services & couverture par les outils open-source

Trois sources couvrent le périmètre complet :

| Bundle | Ce qu'il fournit | Statut |
|---|---|---|
| **Coolify** (ou Dokploy) | PaaS : deploy Git, SSL, env vars, Traefik, projets Next.js | Prêt à l'emploi |
| **`coleam00/local-ai-packaged`** | Ollama + Supabase + n8n + Open WebUI + Qdrant + Neo4j + Flowise + Langfuse + SearXNG + Caddy | Prêt à l'emploi |
| **Compose maison** (le CLI le génère) | OpenClaw + DeepAgents + sandbox isolée + monitoring | À écrire (~30 lignes) |

### 4.1 prod_net — Production (fourni par Coolify + apps Next.js)
| Service | Source | Port interne | Rôle |
|---|---|---|---|
| Coolify | Installer officiel | 8000 | PaaS (deploy, env vars, projets) |
| Traefik | Inclus dans Coolify | 80 / 443 | Reverse proxy + SSL Let's Encrypt |
| Uptime Kuma | Compose maison | 3001 | Monitoring & alertes |
| App Euglow | Repo Git → Coolify | 3000 | EuglowLabs |
| App InfinixUI | Repo Git → Coolify | 3010 | InfinixUI SaaS |
| App InfinixLoop | Repo Git → Coolify | 3020 | InfinixLoop |
| App EduMatch | Repo Git → Coolify | 3030 | EduMatch |

### 4.2 ai_net — IA (fourni à 80% par `local-ai-packaged`)
| Service | Source | Port interne | Rôle |
|---|---|---|---|
| **PostgreSQL + Supabase** | `local-ai-packaged` | 5432 / 54323 | BDD + Auth + Storage + pgvector |
| **Ollama** | `local-ai-packaged` | 11434 | Runner LLMs locaux |
| **n8n** | `local-ai-packaged` | 5678 | Workflows |
| **Open WebUI** | `local-ai-packaged` | 3000 | UI chat ChatGPT-like |
| **Qdrant** | `local-ai-packaged` | 6333 | BDD vectorielle (RAG) |
| **Neo4j** | `local-ai-packaged` | 7474 | Graph DB (GraphRAG) |
| **Flowise** | `local-ai-packaged` | 3300 | No-code agent builder |
| **Langfuse** | `local-ai-packaged` | 3400 | Observabilité LLM |
| **SearXNG** | `local-ai-packaged` | 8080 | Recherche web privée |
| OpenClaw | Compose maison | 3100 | AI Gateway (routing modèles, fallback cloud) |
| DeepAgents | Compose maison | 3200 | Orchestration agents AI |

### 4.3 sandbox_net — Isolation totale (compose maison)
| Service | Source | Port interne | Rôle |
|---|---|---|---|
| Code Executor | Compose maison | — | Exécution code généré (FS read-only) |
| Code Server | Compose maison | 8080 | IDE browser pour tests isolés |

---

## 5. Le CLI d'automatisation `infra` (nouveau v2.0)

### 5.1 Objectif
Une seule commande pour passer de zéro à infra complète, en local **ou** sur VPS, avec la même config.

### 5.2 Architecture en 3 couches
```
┌─────────────────────────────────────────┐
│  CLI TypeScript (DX, prompts, progress) │  ← change souvent
└─────────────────────────────────────────┘
                  │
┌─────────────────────────────────────────┐
│  Ansible playbooks (idempotents)        │  ← stable
└─────────────────────────────────────────┘
                  │
┌─────────────────────────────────────────┐
│  Docker Compose templates               │  ← très stable
└─────────────────────────────────────────┘
```

### 5.3 Stack technique du CLI
| Couche | Outil | Rôle |
|---|---|---|
| Runtime | Bun (ou Node) | Exécution + single binary |
| Framework CLI | clipanion ou commander | Routing commandes |
| Prompts | @clack/prompts | UI interactive moderne |
| API VPS | hetzner-cloud-js | Provisioning |
| API DNS | cloudflare SDK | DNS + Tunnel |
| SSH distant | node-ssh | Exec sur VPS, stream stdout |
| Validation config | zod | Type-safety du `infra.config.yml` |
| Templating | eta | Génération `.env` et compose |
| State | `.infra/state.json` | Tracking de ce qui est déployé |

### 5.4 Surface CLI

```bash
# Bootstrap interactif
infra init                       # questions: domaine, target, plan, email

# Déploiement
infra deploy                     # applique tout depuis zero ou applique le diff
infra deploy --only=ai           # déploie uniquement la stack IA
infra deploy --only=sandbox      # déploie uniquement la sandbox

# Opérations
infra status                     # health check de tous les services
infra logs <service>             # tail des logs
infra restart <service>          # redémarrage d'un service
infra backup                     # backup manuel + push R2
infra restore <backup-id>        # restauration depuis backup

# Multi-projets
infra project add euglow         # ajoute un projet Next.js depuis GitHub
infra project list
infra project deploy euglow

# Migration
infra migrate --from=local --to=<vps-ip>

# Destroy (avec confirmation)
infra destroy
```

### 5.5 Fichier de config déclaratif

```yaml
# infra.config.yml — UNE source de vérité, versionnée dans Git
project: johann-stack
target: local                  # ← bascule local | vps, le reste ne change pas
domain: mondomaine.dev
email: johann@mondomaine.dev

provider:                       # ignoré si target=local
  name: hetzner
  plan: cx32
  location: fsn1
  ssh_key: ~/.ssh/id_ed25519.pub

dns:
  provider: cloudflare
  zone: mondomaine.dev
  api_token: ${CLOUDFLARE_TOKEN}
  tunnel: true                  # actif en target=local pour HTTPS public

stack:
  paas: coolify                 # ou dokploy
  ai_stack: true                # déploie local-ai-packaged
  sandbox: true                 # déploie la sandbox isolée
  monitoring: uptime-kuma

backups:
  enabled: true
  schedule: "0 2 * * *"
  retention_days: 7
  remote:
    provider: r2
    bucket: mondomaine-backups

services:
  ollama:
    models:
      - mistral:7b
      - deepseek-coder:6.7b
      - nomic-embed-text

projects:
  - name: euglow
    repo: github.com/johann/euglow
    subdomain: euglow
    branch: main
  - name: infinixui
    repo: github.com/johann/infinixui
    subdomain: infinixui
```

### 5.6 Pattern d'adapter local/VPS dans le code
```typescript
const adapter = config.target === 'local'
  ? new LocalAdapter()                      // execa direct, pas de SSH
  : new VPSAdapter(config.provider);        // node-ssh + Hetzner API

await deployStack(adapter, config);         // ← logique commune des deux côtés
```

**95 % du code est partagé.** Seule la couche d'exécution (commandes locales vs SSH distant) diffère.

---

## 6. Mode dual : Local ↔ VPS unifié (nouveau v2.0)

### 6.1 Ce qui est rigoureusement identique
- Les `docker-compose.yml` et templates
- Les volumes, les réseaux, le DNS interne (`http://ollama:11434`)
- Les variables d'environnement
- Les modèles Ollama
- Les data Postgres
- Les commandes du CLI

### 6.2 Ce qui change automatiquement selon `target`
| Composant | `target: local` | `target: vps` |
|---|---|---|
| Provisioning | Aucun | API Hetzner |
| Exec commandes | `execa` direct | SSH via `node-ssh` |
| Accès aux services | Cloudflare Tunnel → `*.mondomaine.dev` | DNS A wildcard → IP VPS |
| SSL HTTPS | Géré par Cloudflare Tunnel | Let's Encrypt via Traefik |
| Hardening (UFW, fail2ban) | Skip | Activé |
| Backups distants | Optionnel | Obligatoire |

### 6.3 Bénéfice clé : mêmes URLs en local et en prod
Avec Cloudflare Tunnel en mode local, `euglow.mondomaine.dev` pointe vers ta machine. Quand tu bascules `target: vps`, le CLI :
1. Désactive le tunnel.
2. Update le record DNS A vers l'IP du VPS.
3. **Mêmes URLs**, aucune modif dans tes apps Next.js, aucun env var à changer.

### 6.4 Workflow complet
```bash
# Phase 1 — dev local
infra init --target=local
infra deploy
# → tout tourne sur WSL2, accessible via tunnel sur *.mondomaine.dev

# Phase 2 — bascule prod
# Édite infra.config.yml : target: vps
infra deploy
# → provisionne CX32, copie config, restore le backup local
# → 8-10 min plus tard, mêmes URLs sur infra publique
```

---

## 7. Stack technique récapitulative

| Couche | Outil | Remplace |
|---|---|---|
| **CLI bootstrap** | `infra` (custom) | Setup manuel multi-heures |
| Orchestration & deploy | Coolify (ou Dokploy) | Vercel Pro |
| Reverse proxy + SSL | Traefik (inclus Coolify) | — |
| BDD + Auth + Storage | Supabase self-hosted (via local-ai-packaged) | Supabase Pro |
| BDD vectorielle | Qdrant + pgvector | Pinecone |
| Knowledge graph | Neo4j | — |
| LLM runtime | Ollama | OpenAI API (en partie) |
| AI gateway | OpenClaw | LiteLLM |
| Agents AI | DeepAgents | LangSmith / Custom |
| Workflows | n8n | Zapier / Make |
| Chat UI | Open WebUI | ChatGPT |
| Observabilité LLM | Langfuse | LangSmith |
| Recherche privée | SearXNG | — |
| CI/CD | GitHub Actions → webhook Coolify | Vercel Git |
| Secrets | Coolify natif | — |
| Monitoring | Uptime Kuma | UptimeRobot |
| Container registry | GitHub Container Registry | — |
| DNS + SSL + tunnel | Cloudflare | — |

---

## 8. Modèles LLM (Ollama)

### 8.1 Modèles installés au bootstrap (config CLI)
```yaml
services:
  ollama:
    models:
      - mistral:7b           # Généraliste, ~4 Go RAM
      - deepseek-coder:6.7b  # Code generation, ~4 Go RAM
      - llama3.2:3b          # Léger pour tests rapides, ~2 Go RAM
      - qwen2.5:7b           # Bon ratio qualité/taille
      - nomic-embed-text     # Embeddings RAG, ~300 Mo
```

### 8.2 Politique d'usage
- **Modèles 3B** pour les tâches en temps réel (chat, autocomplete).
- **Modèles 7B** pour la génération de contenu, classification.
- **Fallback cloud** (GPT-4o ou Claude) défini dans OpenClaw — bascule automatique selon la complexité.

### 8.3 Ressources requises
Sur VPS CX32 (8 Go RAM), faire tourner uniquement les modèles 3B en simultané. Pour les modèles 7B+, utiliser un VPS dédié IA (CPX41, 16 Go RAM, ~25 €/mois) ou bascule cloud.

---

## 9. Structure du repo CLI + infra

```
infra-cli/                                # repo du CLI
├── src/
│   ├── commands/
│   │   ├── init.ts
│   │   ├── deploy.ts
│   │   ├── backup.ts
│   │   └── migrate.ts
│   ├── adapters/
│   │   ├── local.ts                      # execa
│   │   └── vps.ts                        # node-ssh + Hetzner SDK
│   ├── core/
│   │   ├── config-schema.ts              # zod
│   │   ├── state.ts
│   │   └── stack.ts                      # logique commune
│   └── templates/
│       ├── docker-compose.prod.yml.eta
│       ├── docker-compose.ai.yml.eta
│       ├── docker-compose.sandbox.yml.eta
│       └── env.eta
├── ansible/
│   ├── roles/
│   │   ├── hardening/
│   │   ├── docker/
│   │   ├── coolify/
│   │   ├── ai-stack/
│   │   ├── sandbox/
│   │   └── backups/
│   └── playbook.yml
└── package.json

# Sortie générée par le CLI dans le projet utilisateur :
~/projects/mon-infra/
├── infra.config.yml                      # source de vérité
├── .infra/
│   ├── state.json                        # état du déploiement
│   └── generated/                        # composes générés
└── backups/
```

---

## 10. Domaines & DNS

### 10.1 Registrar : Cloudflare
- Pas de markup (~10 €/an pour `.dev`)
- DNS rapide (propagation < 1 min)
- Tunnel inclus (exposition locale sans port forward)
- SSL universel
- Acceptable RGPD avec datacenters EU

### 10.2 Configuration DNS (générée par le CLI)
```
Type   Nom   Valeur                Proxy
A      @     <IP VPS ou tunnel>    ✅
A      *     <IP VPS ou tunnel>    ✅  ← wildcard couvre TOUT
```

### 10.3 Sous-domaines de production
| Sous-domaine | Service |
|---|---|
| `coolify.mondomaine.dev` | Coolify dashboard |
| `traefik.mondomaine.dev` | Traefik dashboard (basic auth) |
| `supabase.mondomaine.dev` | Supabase Studio |
| `n8n.mondomaine.dev` | n8n |
| `chat.mondomaine.dev` | Open WebUI |
| `flowise.mondomaine.dev` | Flowise |
| `langfuse.mondomaine.dev` | Langfuse |
| `status.mondomaine.dev` | Uptime Kuma |
| `euglow.mondomaine.dev` | App Euglow |
| `infinixui.mondomaine.dev` | App InfinixUI |
| `infinixloop.mondomaine.dev` | App InfinixLoop |
| `edumatch.mondomaine.dev` | App EduMatch |
| `openclaw.mondomaine.dev` | OpenClaw API |
| `agents.mondomaine.dev` | DeepAgents |

---

## 11. Sécurité

### 11.1 Règles réseau Docker
```yaml
networks:
  prod_net:
    driver: bridge
  ai_net:
    driver: bridge
  sandbox_net:
    driver: bridge
    internal: true   # CRITIQUE : aucun accès internet, aucun accès aux autres réseaux
```

### 11.2 Sandbox : protection multi-couches
- **FS read-only** : `volumes: [...]:ro`
- **Capabilities Linux** désactivées : `cap_drop: [ALL]`
- **No new privileges** : `security_opt: [no-new-privileges:true]`
- **Limite ressources** : `mem_limit: 512m`, `cpus: 0.5`
- **Pas de partage de volume** avec la prod.
- **Timeout d'exécution** : tout process > 30s est tué.

### 11.3 Hardening VPS (rôle Ansible automatique)
- Auth SSH par clé uniquement (mot de passe désactivé).
- Port SSH non standard (paramétrable dans `infra.config.yml`).
- `fail2ban` activé.
- UFW : seuls 80, 443, et SSH ouverts.
- Mises à jour de sécurité automatiques (`unattended-upgrades`).

### 11.4 Secrets
- Aucun secret en clair dans les composes versionnés.
- `.env` chiffré au repos via `git-crypt` ou stocké uniquement par le CLI dans `.infra/`.
- Rotation des `JWT_SECRET` et `POSTGRES_PASSWORD` tous les 90 jours (commande `infra rotate-secrets`).

### 11.5 Headers HTTP (Traefik, configuré par Coolify)
```yaml
headers:
  customResponseHeaders:
    Strict-Transport-Security: "max-age=31536000; includeSubDomains"
    X-Content-Type-Options: "nosniff"
    X-Frame-Options: "DENY"
    Referrer-Policy: "strict-origin-when-cross-origin"
```

---

## 12. Backup & Restauration

### 12.1 Stratégie 3-2-1
- 3 copies des données (prod + backup local + backup distant).
- 2 supports différents (volume Docker + objet storage).
- 1 copie hors site (Cloudflare R2 ou Backblaze B2).

### 12.2 Backup automatique (déclenché par le CLI)
Le rôle Ansible `backups` configure :
- Cron quotidien à 02h00 (`infra backup` en interne).
- Dump `pg_dumpall` + snapshots des volumes critiques (`ollama_data`).
- Rotation : 7 derniers backups conservés en local, illimité sur R2.
- Upload distant via `rclone`.

### 12.3 Restauration
```bash
infra restore                      # liste les backups dispos
infra restore db_20260501_020000   # restaure un backup spécifique
```

### 12.4 Test de restauration
**Tous les 30 jours** : `infra restore --to-staging` lance une restauration sur VPS de test. Un backup non testé n'est pas un backup.

---

## 13. Migration locale → VPS (orchestrée par le CLI)

### 13.1 Pré-requis
Tout est dans `infra.config.yml`. Le CLI vérifie qu'il a :
- Token API Hetzner (env var ou prompt).
- Token API Cloudflare.
- Clé SSH publique.
- Domaine déjà enregistré chez Cloudflare.

### 13.2 Commande
```bash
# Édite infra.config.yml : target: local → target: vps
infra deploy
```

### 13.3 Ce que fait le CLI en interne
1. **Provisionne** le VPS via API Hetzner (~30s).
2. **Hardening** SSH + UFW + fail2ban via Ansible (~1 min).
3. **Installe** Docker + Coolify (~2 min).
4. **Met à jour** le DNS Cloudflare (record A → IP VPS).
5. **Désactive** le Cloudflare Tunnel local.
6. **Backup final** local.
7. **Copie** les composes générés + le dump SQL vers le VPS.
8. **Restore** la BDD sur le VPS.
9. **Lance** la stack via `docker compose up -d`.
10. **Vérifie** que tous les services répondent (health check).
11. **Affiche** les URLs publiques.

**Downtime estimé : < 5 min** si DNS TTL est à 60s.

---

## 14. Monitoring & Observabilité

### 14.1 Uptime Kuma (déployé par le CLI)
- Monitor HTTP toutes les 60s pour chaque sous-domaine.
- Alertes Discord / email si downtime > 2 min.
- Page status publique sur `status.mondomaine.dev`.

### 14.2 Logs
- Tous les containers : `logging.driver: json-file` avec rotation (`max-size: 10m`, `max-file: 3`).
- Agrégation optionnelle via Dozzle (`amir20/dozzle`) — UI web pour parcourir tous les logs Docker.

### 14.3 Métriques LLM
Langfuse (inclus dans `local-ai-packaged`) trace toutes les requêtes Ollama : coût, latence, tokens, prompts, A/B tests.

### 14.4 Métriques infra
Phase 1 : `docker stats` + Coolify dashboard.
Phase 2 (si besoin) : ajouter Prometheus + Grafana via stack `dockprom`.

---

## 15. Coûts mensuels estimés

| Phase | Infra | Coût/mois |
|---|---|---|
| **Phase 0** — Dev local | WSL2 + Cloudflare Tunnel + domaine | ~1 € (domaine amorti) |
| **Phase 1** — Lancement | VPS Hetzner CX32 + domaine | ~7 € |
| **Phase 2** — Premiers users | VPS CPX31 (16 Go) + R2 backup + domaine | ~14 € |
| **Phase 3** — Trafic réel | CPX31 prod + CX22 staging + R2 + Cloudflare Pro | ~25 € |
| **Phase 4** — Scaling | Multi-VPS (prod / IA / staging) + R2 + monitoring | ~50 € |

**Comparaison équivalent cloud** : la même charge sur Vercel Pro + Supabase Pro + OpenAI API démarre à **80–150 €/mois** et scale linéairement avec l'usage.

---

## 16. Roadmap d'implémentation (refonte v2.0)

### Phase A — MVP Bash (1 weekend)
- [ ] Script `bootstrap.sh <ip> <domaine> <email>` qui enchaîne tout.
- [ ] Test sur VPS Hetzner réel.
- [ ] Test en local (mode dégradé sans hardening).
- [ ] Documentation README minimale.

### Phase B — Wrapping Ansible (1 semaine)
- [ ] Découpage en rôles : `hardening`, `docker`, `coolify`, `ai-stack`, `sandbox`, `backups`, `dns`.
- [ ] Idempotence : relancer 10 fois converge sur le même état.
- [ ] Variables centralisées dans `group_vars/`.
- [ ] Test du playbook complet sur VPS et en local.

### Phase C — CLI TypeScript (2 semaines)
- [ ] Setup repo `infra-cli` avec Bun + clipanion + zod.
- [ ] Schema `infra.config.yml` avec validation zod.
- [ ] Commande `infra init` interactive (@clack/prompts).
- [ ] Adapters `LocalAdapter` et `VPSAdapter`.
- [ ] Intégration Ansible via `execa` ou `node-ssh`.
- [ ] Commande `infra deploy` avec progress bars.
- [ ] Commandes `status`, `logs`, `backup`, `restore`.
- [ ] Commandes `project add/list/deploy`.
- [ ] State management dans `.infra/state.json`.

### Phase D — Mise en prod réelle (1 semaine)
- [ ] Provisionner VPS Hetzner CX32 via `infra deploy`.
- [ ] Migrer EuglowLabs depuis Vercel.
- [ ] Migrer InfinixUI depuis Vercel.
- [ ] Migrer InfinixLoop depuis Vercel.
- [ ] Migrer EduMatch.
- [ ] Connecter Discord pour alertes Uptime Kuma.
- [ ] Tester un restore complet de bout en bout.

### Phase E — Polish & open-source (optionnel, 2-4 semaines)
- [ ] Documentation complète + site doc (Astro/Starlight).
- [ ] Tests unitaires + tests E2E (sur VPS de test).
- [ ] Publier le CLI sur npm.
- [ ] Publier les rôles Ansible sur Galaxy.
- [ ] Logo + landing page (sous EuglowLabs ?).

---

## 17. Critères de succès

L'infra est considérée **opérationnelle** quand :

1. ✅ `infra init` puis `infra deploy` suffisent à passer de zéro à infra fonctionnelle (local ou VPS).
2. ✅ Tous les projets sont accessibles via leur sous-domaine HTTPS.
3. ✅ Un `git push` sur `main` redéploie automatiquement l'app concernée.
4. ✅ Un backup quotidien tourne sans erreur, avec copie distante.
5. ✅ Une restauration test a été validée dans les 30 derniers jours.
6. ✅ Le coût mensuel est < 15 €.
7. ✅ Un agent AI peut tourner via Ollama sans toucher la prod.
8. ✅ La sandbox est confirmée isolée (test : un script ne peut pas pinger google.com depuis sandbox_net).
9. ✅ Uptime > 99.5 % sur 30 jours.
10. ✅ La bascule `target: local` ↔ `target: vps` se fait sans modifier aucune autre ligne de config.

---

## 18. Décisions ouvertes à trancher

1. **Coolify vs Dokploy par défaut** ? Coolify si on privilégie les features, Dokploy si on privilégie la légèreté du CLI sur petits VPS. *Proposition : Coolify par défaut, Dokploy en option dans `infra.config.yml`.*

2. **Bun vs Node pour le CLI** ? Bun est plus rapide et compile en single binary, mais écosystème moins mature pour les SDKs Hetzner/Cloudflare. *Proposition : commencer en Node, migrer vers Bun si pertinent.*

3. **Open-source ou interne** ? Définit l'effort : interne = 2-3 semaines, OSS propre = 2-3 mois (doc, tests, packaging). *Proposition : commencer interne, ouvrir si la dogfood valide.*

4. **Inclure OpenClaw + DeepAgents dans le bootstrap par défaut** ? Augmente la complexité initiale. *Proposition : flag `--with-agents` opt-in dans `infra deploy`.*

5. **Prévoir un mode multi-VPS dès la v1** ? Coolify le supporte via Swarm. *Proposition : non, scope creep — phase 4 uniquement.*

---

## 19. Annexe — Squelette `docker-compose.sandbox.yml` (le seul à écrire à la main)

Le reste des composes est fourni par Coolify et `local-ai-packaged`. La sandbox isolée est la pièce manquante :

```yaml
version: "3.9"

networks:
  sandbox_net:
    driver: bridge
    internal: true   # CRITIQUE : isolation totale

volumes:
  sandbox_workspace:

services:
  code-executor:
    image: node:20-alpine
    restart: unless-stopped
    command: tail -f /dev/null   # process minimal, exec à la demande
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    mem_limit: 512m
    cpus: 0.5
    tmpfs:
      - /tmp:size=64m
    networks:
      - sandbox_net

  code-server:
    image: codercom/code-server:latest
    restart: unless-stopped
    environment:
      PASSWORD: ${CODE_SERVER_PASSWORD}
    volumes:
      - sandbox_workspace:/home/coder/workspace
    networks:
      - sandbox_net
```

---

## 20. Annexe — Squelette `docker-compose.agents.yml` (OpenClaw + DeepAgents)

```yaml
version: "3.9"

networks:
  ai_net:
    external: true        # créé par local-ai-packaged
  sandbox_net:
    external: true        # créé par compose sandbox

services:
  openclaw:
    image: ghcr.io/openclaw/openclaw:latest
    restart: unless-stopped
    environment:
      OLLAMA_BASE_URL: http://ollama:11434     # service de local-ai-packaged
      DEFAULT_MODEL: ${OPENCLAW_DEFAULT_MODEL}
      FALLBACK_MODEL: ${OPENCLAW_FALLBACK_MODEL}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    labels:
      - traefik.enable=true
      - traefik.http.routers.openclaw.rule=Host(`openclaw.${BASE_DOMAIN}`)
      - traefik.http.routers.openclaw.tls.certresolver=letsencrypt
    networks:
      - ai_net

  deepagents:
    image: deepagents/deepagents:latest
    restart: unless-stopped
    environment:
      LLM_PROVIDER: openclaw
      OPENCLAW_URL: http://openclaw:3100
      QDRANT_URL: http://qdrant:6333          # service de local-ai-packaged
    labels:
      - traefik.enable=true
      - traefik.http.routers.agents.rule=Host(`agents.${BASE_DOMAIN}`)
      - traefik.http.routers.agents.tls.certresolver=letsencrypt
    depends_on:
      - openclaw
    networks:
      - ai_net
      - sandbox_net   # accès au sandbox pour déclencher exécution
```

---

**Fin de la spec — v2.0**
