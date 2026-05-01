# SPEC PRODUIT — EuglowLabs ARC

> *Autonomous Resource Cloud*
> Le cockpit self-hosted du solo founder qui auto-héberge sa stack IA.

| Champ | Valeur |
|---|---|
| **Version** | 1.0 |
| **Date** | Mai 2026 |
| **Auteur** | Johann |
| **Statut** | Vision produit → MVP |
| **Cible niveau** | 3 (incluant niveaux 1 et 2) |
| **Document parent** | `spec-infra-selfhosted-v2.md` |

---

## TABLE DES MATIÈRES

1. [Vision & positionnement](#1-vision--positionnement)
2. [Marché & personas](#2-marché--personas)
3. [Architecture produit globale](#3-architecture-produit-globale)
4. [Composant 1 — Le CLI `arc`](#4-composant-1--le-cli-arc)
5. [Composant 2 — La stack infra déployée](#5-composant-2--la-stack-infra-déployée)
6. [Composant 3 — Le dashboard ARC](#6-composant-3--le-dashboard-arc)
7. [Composant 4 — Plateforme multi-tenant (Niveau 3)](#7-composant-4--plateforme-multi-tenant-niveau-3)
8. [Composant 5 — Marketplace de templates](#8-composant-5--marketplace-de-templates)
9. [Composant 6 — AI Copilot "Sentinel"](#9-composant-6--ai-copilot-sentinel)
10. [Composant 7 — API publique & écosystème](#10-composant-7--api-publique--écosystème)
11. [Stack technique complète](#11-stack-technique-complète)
12. [Sécurité, conformité, légal](#12-sécurité-conformité-légal)
13. [Modèle économique](#13-modèle-économique)
14. [Roadmap & phases](#14-roadmap--phases)
15. [KPIs & métriques de succès](#15-kpis--métriques-de-succès)
16. [Risques & mitigations](#16-risques--mitigations)
17. [Annexes](#17-annexes)

---

## 1. Vision & positionnement

### 1.1 Pitch en une phrase
**EuglowLabs ARC** transforme n'importe quel VPS en plateforme complète "Vercel + Supabase + Ollama" en une seule commande, avec un cockpit pour superviser et opérer toute la stack.

### 1.2 Pitch long
Les solo founders et indie hackers d'aujourd'hui jonglent entre Vercel (frontends), Supabase (BDD), OpenAI (IA), Railway (workers), Stripe (billing), Sentry (monitoring) — chacun avec son propre tarif qui croît avec l'usage. À 5 projets, la facture mensuelle dépasse 200 € avant même d'avoir un seul utilisateur payant.

ARC casse ce schéma : un VPS à 7 €, une commande, et tu obtiens une plateforme self-hosted équivalente, supervisée via un cockpit unifié, avec une stack IA locale (Ollama) déjà câblée. Tu paies une fois ton VPS, point.

### 1.3 Positionnement marché

| Outil | Couvre | Ne couvre pas |
|---|---|---|
| **Vercel / Netlify** | Frontends only | BDD, IA, workers, multi-projet, self-hosted |
| **Coolify / Dokploy** | PaaS self-hosted | Provisioning, IA stack, multi-tenant, dashboard agrégé |
| **Railway / Render** | PaaS managé | Self-hosted, contrôle, prix prévisible |
| **Northflank / Fly** | PaaS managé moderne | Self-hosted, IA locale |
| **Umbrel / CasaOS** | Home server | Production, multi-projet, déploiement Git |
| **Portainer** | Container management | Git deploy, SSL auto, IA, business metrics |
| **EuglowLabs ARC** | **Bootstrap + supervision + IA + multi-tenant** | — |

ARC n'est pas un concurrent direct de Coolify — il l'**intègre**. ARC est la couche au-dessus qui rend Coolify utilisable comme un produit fini pour solo founders.

### 1.4 Différenciateurs clés
1. **Une seule commande** pour le bootstrap complet (CLI + Ansible + Compose).
2. **Stack IA pré-configurée** (Ollama + agents + sandbox) absente de tous les concurrents.
3. **Cockpit unifié** qui agrège Coolify + Ollama + Langfuse + Uptime Kuma + ton config.
4. **Mode dual local/VPS** identique pour dev et prod.
5. **Business metrics** (économies vs cloud, coût par user) absentes ailleurs.
6. **AI Copilot "Sentinel"** qui debug ta stack en langage naturel.
7. **Marketplace de templates** d'apps + agents IA pré-configurés.
8. **API publique** pour étendre via plugins.

---

## 2. Marché & personas

### 2.1 Taille de marché
- **Indie hackers / solo founders** : ~2M dans le monde (estimation Indie Hackers + Product Hunt).
- **Self-hosting enthusiasts** : ~500k actifs (r/selfhosted = 500k+ subscribers en 2026).
- **Petites agences (1-5 devs)** qui hébergent des projets clients.
- **Étudiants / chercheurs IA** voulant une stack locale propre.

### 2.2 Personas cibles

#### Persona principal — "Le solo founder polyvalent" (Johann himself)
- Builds 3-8 projets en parallèle (SaaS, side-projects)
- Stack moderne : Next.js, Postgres, IA générative
- Sensible aux coûts (refuse 50 €/mois en infra avant d'avoir des revenus)
- Compétent technique mais pas ops-fan
- Veut déployer en push, ne pas gérer de VM
- **Plan ciblé : Pro (~12 €/mois)**

#### Persona secondaire — "L'agence indé" (3-10 devs)
- Héberge 10-30 projets clients
- Besoin de séparation client / staging / prod
- Compliance basique (RGPD)
- Migration depuis Vercel/Heroku
- **Plan ciblé : Team (~40 €/mois)**

#### Persona tertiaire — "Le data scientist autonome"
- Veut Ollama + Jupyter + Postgres + n8n localement
- Pas de connaissance ops avancée
- Besoin de sandbox pour exécuter du code généré
- **Plan ciblé : Hobby (free) → Pro**

### 2.3 Cas d'usage concrets
- Migrer 5 projets de Vercel → 1 VPS sans passer 3 weekends à configurer.
- Lancer un stack RAG (Ollama + Qdrant + n8n) en 10 min pour prototyper.
- Donner à un client un dashboard pour qu'il voit ses propres apps.
- Audit sécurité visuel : "qui peut parler à qui dans mon infra ?"
- Tracker l'économie mensuelle vs Vercel + Supabase + OpenAI.

---

## 3. Architecture produit globale

### 3.1 Les 3 niveaux composés
ARC est un produit multi-couche. Chaque niveau s'appuie sur le précédent.

```
┌────────────────────────────────────────────────────────────┐
│  NIVEAU 3 — Plateforme SaaS multi-tenant                   │
│  • Auth + permissions + organisations                      │
│  • Billing Stripe                                          │
│  • Marketplace de templates                                │
│  • API publique + plugins                                  │
│  • AI Copilot "Sentinel"                                   │
├────────────────────────────────────────────────────────────┤
│  NIVEAU 2 — Cockpit avancé                                 │
│  • Topologie réseau visuelle                               │
│  • Audit sandbox & sécurité                                │
│  • Business metrics (économies, coût/user)                 │
│  • Vue cross-environment local↔VPS                         │
│  • Conformité config ↔ état réel                           │
│  • Notifications custom (Discord, email, webhook)          │
├────────────────────────────────────────────────────────────┤
│  NIVEAU 1 — Status page agrégée                            │
│  • Liste projets & apps                                    │
│  • État serveurs (CPU/RAM/disk)                            │
│  • Logs streamés                                           │
│  • LLM metrics (Langfuse)                                  │
│  • Uptime (Uptime Kuma)                                    │
├────────────────────────────────────────────────────────────┤
│  COMPOSANT — Stack infra déployée                          │
│  Coolify + local-ai-packaged + sandbox + agents            │
├────────────────────────────────────────────────────────────┤
│  COMPOSANT — CLI `arc`                                     │
│  Bootstrap, deploy, backup, migrate, project mgmt          │
└────────────────────────────────────────────────────────────┘
```

### 3.2 Schéma d'architecture (cible Niveau 3)

```
                     ┌──────────────────────────────┐
                     │   ARC Cloud (multi-tenant)   │
                     │   arc.euglowlabs.com         │
                     │   • Auth (Clerk/Supabase)    │
                     │   • Stripe billing           │
                     │   • Org / users / API keys   │
                     │   • Marketplace              │
                     └──────────────┬───────────────┘
                                    │
                                    ▼ (API publique REST/WS)
   ┌────────────────────────────────────────────────────────┐
   │              ARC Dashboard (Next.js 15)                 │
   │  Self-hosted ou cloud, branding configurable            │
   │  • Niveau 1 : Status page                               │
   │  • Niveau 2 : Cockpit avancé                            │
   │  • Niveau 3 : Multi-tenant features                     │
   └────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (read-only API + WebSocket)
   ┌────────────────────────────────────────────────────────┐
   │              ARC Agent (sur chaque VPS managé)          │
   │  Service Go ou Node léger sur le VPS                    │
   │  • Expose state du VPS via API authentifiée             │
   │  • Stream metrics via WebSocket                         │
   │  • Reçoit commandes du dashboard (deploy, backup)       │
   └────────────────────────────────────────────────────────┘
                                    │
                                    ▼
   ┌──────────┬──────────┬──────────┬──────────┬──────────┐
   │ Coolify  │ Ollama   │ Langfuse │ Postgres │ U. Kuma  │
   │ API      │ API      │ API      │          │ API      │
   └──────────┴──────────┴──────────┴──────────┴──────────┘
                          [La stack du VPS]
```

### 3.3 Boundary entre composants
- **CLI `arc`** = bootstrap + opérations en ligne de commande.
- **ARC Agent** = service tournant sur chaque VPS, expose l'état au dashboard.
- **ARC Dashboard** = UI Next.js, peut être self-hosted (gratuit) ou utilisé via cloud (payant).
- **ARC Cloud** = backend SaaS multi-tenant (auth, billing, marketplace, AI Copilot).

Un utilisateur peut :
- Utiliser **uniquement le CLI** → gratuit, 100% open-source.
- Ajouter **le Dashboard self-hosted** → gratuit, open-source.
- Souscrire à **ARC Cloud** → multi-tenant, AI Copilot, marketplace, support → payant.

---

## 4. Composant 1 — Le CLI `arc`

> Référence détaillée : §5 du document `spec-infra-selfhosted-v2.md`.
> Cette section ajoute les éléments produit au-delà de la spec technique.

### 4.1 Renaming `infra` → `arc`
Le CLI s'appelle désormais **`arc`** pour cohérence de marque.

```bash
arc init
arc deploy
arc status
arc project add <name>
arc backup
arc migrate
```

### 4.2 Distribution
- **npm** : `npm install -g @euglowlabs/arc`
- **Homebrew** : `brew install euglowlabs/arc/arc`
- **Curl install** : `curl -fsSL https://arc.euglowlabs.com/install.sh | bash`
- **Single binary** (via Bun compile) pour Linux / macOS / Windows.

### 4.3 Modes d'exécution

| Mode | Description | Cible |
|---|---|---|
| `--standalone` | CLI seul, pas de dashboard, pas de cloud | Hackers minimalistes |
| `--with-dashboard` | Déploie aussi le Dashboard self-hosted | Solo founders |
| `--cloud` | Connecte à ARC Cloud (auth + sync) | Plans payants |

### 4.4 Telemetry opt-in
Anonyme, opt-in à l'install : nombre de VPS gérés, stack choisie, version. Aide à prioriser le développement. Désactivable via `arc config telemetry off`.

---

## 5. Composant 2 — La stack infra déployée

> Référence détaillée : §3-§14 du document `spec-infra-selfhosted-v2.md`.

### 5.1 Récap
Le CLI `arc deploy` installe sur le VPS (ou en local) :
- **Coolify** (PaaS, deploy Git)
- **`local-ai-packaged`** (Ollama + Supabase + n8n + Open WebUI + Qdrant + Neo4j + Flowise + Langfuse + SearXNG + Caddy)
- **OpenClaw + DeepAgents** (compose maison)
- **Sandbox isolée** (compose maison)
- **Uptime Kuma** (monitoring)
- **ARC Agent** (le service de supervision, ajouté en v3.0)

### 5.2 Nouveau composant : ARC Agent (v3.0)

Service léger (Go ou Node) installé par le CLI sur chaque VPS managé. Rôle :

- Expose une **API authentifiée** (token signé par ARC Cloud) accessible uniquement par le Dashboard.
- Agrège les API de Coolify / Ollama / Langfuse / Uptime Kuma / Docker socket.
- Stream les métriques via **WebSocket** vers le Dashboard.
- Reçoit des **commandes** (deploy, backup, restart) et les exécute via Coolify ou shell.
- Renvoie les logs structurés à ARC Cloud (opt-in).

```
┌────────────────────────────────────────────┐
│  ARC Agent (port 9999, authenticated)      │
│                                            │
│  GET  /v1/status      → état global        │
│  GET  /v1/projects    → liste projets      │
│  GET  /v1/services    → état containers    │
│  GET  /v1/llm/metrics → stats Ollama       │
│  POST /v1/deploy      → déclenche deploy   │
│  WS   /v1/stream      → metrics live       │
└────────────────────────────────────────────┘
```

### 5.3 Communication sécurisée
- TLS via certificat auto-généré + pinning sur le Dashboard.
- Token d'auth rotatif (24h), signé par ARC Cloud.
- Optionnel : tunnel Cloudflare au lieu de port public.

---

## 6. Composant 3 — Le dashboard ARC

### 6.1 Architecture du dashboard

```
ARC Dashboard (Next.js 15 App Router)
├── /(auth)/                # Login, signup
├── /app/
│   ├── overview/           # Niveau 1 : status page
│   ├── projects/           # Liste & gestion projets
│   ├── projects/[id]/      # Détail projet
│   ├── topology/           # Niveau 2 : graph réseau
│   ├── ai-stack/           # Niveau 2 : LLM metrics
│   ├── sandbox/            # Niveau 2 : audit sandbox
│   ├── business/           # Niveau 2 : économies
│   ├── compliance/         # Niveau 2 : config diff
│   ├── marketplace/        # Niveau 3 : templates
│   ├── copilot/            # Niveau 3 : AI Sentinel
│   ├── team/               # Niveau 3 : multi-user
│   ├── billing/            # Niveau 3 : Stripe
│   └── settings/
└── /api/                   # API routes (proxy vers ARC Agent)
```

### 6.2 NIVEAU 1 — Status page (MVP, 1-2 semaines)

#### 6.2.1 Page `/overview`
Vue tableau de bord principale.

**Widgets** :
- Carte métriques globales : nombre de projets, uptime moyen, RAM utilisée, coût mensuel
- Liste des projets avec statut (running / building / failed / stopped)
- Liste des serveurs gérés (local + VPS) avec ressources
- Activité récente (dernier déploiement, dernier backup, dernier incident)
- Quick actions : "Deploy all", "Backup now", "Restart service"

#### 6.2.2 Page `/projects`
Tableau filtrable de tous les projets.

| Colonne | Info |
|---|---|
| Nom | Avec favicon |
| Status | Running / Stopped / Failed |
| Domaine | Lien cliquable |
| Last deploy | Il y a X minutes |
| Repo | GitHub link |
| Uptime 30j | % |
| Actions | Deploy / Logs / Settings |

#### 6.2.3 Page `/projects/[id]`
Détail d'un projet avec :
- État live + ressources consommées
- Logs streamés (terminal embarqué via xterm.js)
- Historique des déploiements (avec rollback)
- Variables d'environnement (éditables, secrets masqués)
- Domaines & SSL
- BDD associées
- Stats trafic (si reverse proxy le donne)

#### 6.2.4 Page `/ai-stack` (sous-set niveau 1)
Vue dédiée à la stack IA :
- Modèles Ollama installés (taille, dernière utilisation)
- Tokens générés sur 24h / 7j / 30j (depuis Langfuse)
- Top agents par activité
- État DeepAgents

### 6.3 NIVEAU 2 — Cockpit avancé (4-6 semaines après niveau 1)

#### 6.3.1 Page `/topology`
**Visualisation interactive** de l'architecture réseau.

- Graph rendu avec **React Flow** ou **D3**.
- Nœuds = containers / réseaux / volumes.
- Arêtes = connexions autorisées entre containers.
- Code couleur par réseau (vert = prod, bleu = ai, rouge = sandbox).
- Hover sur un nœud → détails (image, ports, env vars).
- Click sur un nœud → drill-down vers `/projects/[id]`.
- **Audit visuel** : alerte si un container a un accès non documenté entre réseaux.

#### 6.3.2 Page `/business`
Métriques business agrégées.

**Widgets** :
- "Tu économises **X €/mois** vs équivalent cloud" (avec breakdown : Vercel + Supabase + OpenAI).
- Coût total cumulé depuis le début (VPS + domaine + R2).
- Coût par projet.
- Coût par utilisateur actif (si analytics intégrées).
- Évolution mensuelle (graphique).
- ROI estimé du self-hosting.

Calcul des économies basé sur :
- Vercel Pro = 20 $/user/mois × utilisateurs déclarés
- Supabase Pro = 25 $/mois × organisations
- OpenAI tokens × prix actuel × tokens consommés

#### 6.3.3 Page `/sandbox`
Audit & gouvernance de la sandbox.

- Historique des exécutions (timestamp, agent qui a déclenché, code, durée, résultat).
- Stats : nb d'exécutions, taux de succès, taux de timeout, RAM moyenne.
- Détection d'anomalies (ex: pic d'exécutions inhabituel).
- Configuration : timeout max, RAM limite, capabilities.

#### 6.3.4 Page `/compliance`
Diff entre `infra.config.yml` et état réel.

- ✅ Services conformes
- ⚠️ Services en config mais non déployés
- ⚠️ Services déployés mais non en config (drift)
- ⚠️ Modèles Ollama listés mais non chargés
- Bouton "Reconcile" qui appelle `arc deploy` pour aligner.

#### 6.3.5 Page `/cross-env`
Vue cross-environment (local ↔ VPS).

| Service | Local | Production | Diff |
|---|---|---|---|
| App Euglow | v1.2.3 | v1.2.1 | ⚠️ Local en avance |
| Ollama | mistral:7b | mistral:7b | ✅ |
| Postgres | 16.4 | 16.3 | ⚠️ Version |

#### 6.3.6 Notifications & alertes
- Configuration channels : Discord webhook, email, Slack, custom webhook.
- Règles : "alerte si app down > 2 min", "alerte si Ollama RAM > 80%", etc.

### 6.4 NIVEAU 3 — Plateforme multi-tenant (cf. §7)

---

## 7. Composant 4 — Plateforme multi-tenant (Niveau 3)

### 7.1 ARC Cloud — backend SaaS

Application Next.js distincte du Dashboard self-hosted, hébergée par EuglowLabs.

**Endpoints :**
- `arc.euglowlabs.com` — landing + login + app
- `api.arc.euglowlabs.com` — API publique
- `cdn.arc.euglowlabs.com` — assets, templates marketplace

### 7.2 Auth & organisations

| Concept | Description |
|---|---|
| **User** | Compte individuel (email + password ou OAuth GitHub/Google) |
| **Organization** | Conteneur d'utilisateurs et de VPS (équipe, agence, soi-même) |
| **Membership** | Rôle d'un user dans une org : `owner`, `admin`, `member`, `viewer` |
| **VPS** | Serveur enregistré dans une org (avec son ARC Agent) |
| **Project** | App déployée sur un VPS (vue agrégée) |

### 7.3 Permissions

| Action | Owner | Admin | Member | Viewer |
|---|:---:|:---:|:---:|:---:|
| Voir le dashboard | ✅ | ✅ | ✅ | ✅ |
| Déployer un projet | ✅ | ✅ | ✅ | ❌ |
| Ajouter un VPS | ✅ | ✅ | ❌ | ❌ |
| Inviter un user | ✅ | ✅ | ❌ | ❌ |
| Gérer billing | ✅ | ❌ | ❌ | ❌ |
| Supprimer org | ✅ | ❌ | ❌ | ❌ |

### 7.4 Connexion VPS ↔ ARC Cloud

```bash
# Sur le VPS
arc cloud connect <api-key>
# → ARC Agent enregistre le VPS auprès du Cloud
# → Reçoit un token signé pour l'auth des appels Dashboard
```

### 7.5 Multi-tenant data isolation

- Chaque org a son **schéma Postgres** dédié.
- Les API keys sont scopées par org.
- Les templates marketplace sont publics mais les déploiements sont privés à l'org.
- ARC Cloud ne touche jamais aux **data utilisateurs** des VPS — il ne stocke que les **métriques** et les **commandes**.

### 7.6 Self-hosted ARC Cloud (option enterprise)
Pour les agences ou entreprises qui veulent leur propre instance multi-tenant :
- Image Docker dédiée
- Licence commerciale annuelle
- Support prioritaire

---

## 8. Composant 5 — Marketplace de templates

### 8.1 Concept
Bibliothèque de **templates pré-configurés** qu'un user peut déployer en 1 clic sur son VPS.

### 8.2 Catégories de templates

| Catégorie | Exemples |
|---|---|
| **Apps** | Next.js boilerplate, SvelteKit blog, Astro docs |
| **Backends** | Hono API, FastAPI, Go REST |
| **CMS** | Ghost, Strapi, Directus |
| **Outils** | Plausible, Umami, Linkwarden |
| **Agents IA** | RAG agent, Code review agent, Customer support |
| **Workflows n8n** | Newsletter auto, Lead enrichment, Slack to GitHub |
| **Stacks complètes** | "SaaS starter" (Next + Postgres + Stripe + Auth) |

### 8.3 Structure d'un template

```
my-template/
├── arc-template.yml         # manifest
├── docker-compose.yml       # définition services
├── .env.template            # variables à configurer
├── README.md                # description, screenshots
├── icon.svg                 # icône
└── post-install.sh          # script optionnel
```

### 8.4 Manifest exemple

```yaml
# arc-template.yml
name: rag-agent-starter
display_name: RAG Agent Starter
description: Agent de Q&A documentaire avec Ollama + Qdrant
author: euglowlabs
version: 1.2.0
category: ai-agents
tags: [rag, ollama, qdrant, n8n]
requires:
  ai_stack: true
  min_ram: 4096
inputs:
  - name: ADMIN_EMAIL
    type: email
    required: true
  - name: OLLAMA_MODEL
    type: select
    options: [mistral:7b, llama3.2:3b]
    default: mistral:7b
preview_url: https://cdn.arc.euglowlabs.com/templates/rag-agent/preview.png
```

### 8.5 Modèles économiques templates

| Type | Description | Revenus |
|---|---|---|
| **Free** | Templates communautaires (Apache 2.0) | — |
| **Premium** | Templates payants (€5-50 unitaires) | 70% créateur / 30% ARC |
| **Subscription** | Templates avec mises à jour récurrentes | Revenue share |

Cela ouvre une **économie créateur** : tu peux publier "EuglowLabs SaaS Starter" et le vendre 29 €.

### 8.6 Validation & sécurité
- Tous les templates sont scannés (containers, secrets, permissions).
- Code source des templates premium est lisible avant achat.
- Note communautaire (étoiles, commentaires).

---

## 9. Composant 6 — AI Copilot "Sentinel"

### 9.1 Concept
Assistant IA conversationnel qui aide à opérer la stack en langage naturel.

### 9.2 Capacités

| Catégorie | Exemples de prompts |
|---|---|
| **Diagnostic** | "Pourquoi euglow.com répond 502 depuis 10 min ?" |
| **Action** | "Redéploie infinixui et vide le cache" |
| **Investigation** | "Quel projet consomme le plus de RAM ?" |
| **Recommandation** | "Mon VPS est à 90% RAM, que faire ?" |
| **Apprentissage** | "Explique-moi pourquoi mon Postgres a crashé hier" |
| **Génération** | "Crée un docker-compose pour héberger Plausible" |

### 9.3 Architecture

```
User: "Pourquoi euglow.com répond 502 ?"
        │
        ▼
┌──────────────────────────────────────┐
│  Sentinel (Claude / GPT-4 + Ollama)  │
│  • Reçoit la query                   │
│  • Plan de tools à appeler           │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│  Tools disponibles                   │
│  • get_project_status(id)            │
│  • get_logs(service, since)          │
│  • get_metrics(service)              │
│  • restart_service(id)               │
│  • deploy(project)                   │
│  • backup(project)                   │
└──────────────────────────────────────┘
        │
        ▼
   Réponse synthétique :
   "euglow.com renvoie 502 depuis 10:23.
    La cause : container 'euglow-app' a OOM
    (RAM > 512Mo). Je peux le restart
    avec une limit RAM augmentée à 1Go ?"
   [Oui, fais-le] [Non, j'investigue]
```

### 9.4 Modèles IA utilisés
- **Par défaut (Cloud plan)** : Claude Sonnet (raisonnement) + GPT-4o-mini (tools)
- **Self-hosted (Hobby plan)** : Ollama local (Qwen 2.5 ou DeepSeek)
- **Hybride** : routing automatique selon la complexité de la query

### 9.5 Sécurité
- Sentinel **ne peut jamais** exécuter d'action destructive sans confirmation utilisateur.
- Toutes les actions sont **loggées** et reversibles.
- Confirmation à 2 facteurs pour : `delete`, `migrate`, `destroy`.

### 9.6 Différentiation vs ChatGPT generic
- Sentinel a accès en **temps réel** à l'état de TA stack.
- Sentinel connaît TON `infra.config.yml`, TES projets, TON historique.
- Sentinel peut **agir** directement sur ton infra (pas juste expliquer).

---

## 10. Composant 7 — API publique & écosystème

### 10.1 API publique
REST + WebSocket, documentée OpenAPI, accessible via API key par org.

```http
GET    /v1/orgs/{org}/projects
POST   /v1/orgs/{org}/projects/{id}/deploy
GET    /v1/orgs/{org}/vps
GET    /v1/orgs/{org}/metrics
WS     /v1/orgs/{org}/stream
```

### 10.2 SDK clients
- **TypeScript** : `@euglowlabs/arc-sdk`
- **Python** : `pip install euglowlabs-arc`
- **Go** : `go get github.com/euglowlabs/arc-go`

### 10.3 Webhooks sortants
Notifier des systèmes externes :
- `project.deployed`
- `service.crashed`
- `backup.failed`
- `vps.resource_alert`

### 10.4 Plugin system (futur)
Architecture extension :
- Plugins dashboard (widgets custom)
- Plugins CLI (commandes additionnelles)
- Plugins agent (collecteurs de métriques custom)

Distribués via le marketplace.

---

## 11. Stack technique complète

### 11.1 CLI `arc`
| Couche | Outil |
|---|---|
| Runtime | Bun (single binary) |
| Framework CLI | clipanion |
| Prompts | @clack/prompts |
| API VPS | hetzner-cloud-js |
| API DNS | cloudflare SDK |
| SSH | node-ssh |
| Validation | zod |
| Templating | eta |
| Provisioning lourd | Ansible (sous le capot) |

### 11.2 ARC Agent (sur VPS)
| Couche | Outil |
|---|---|
| Runtime | Go (binary léger ~10 Mo) |
| HTTP framework | chi ou echo |
| WebSocket | gorilla/websocket |
| Docker integration | docker/docker SDK |
| Metrics | Prometheus client |

Pourquoi Go : binaire léger, pas de dépendances runtime, idéal pour un agent.

### 11.3 ARC Dashboard
| Couche | Outil |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind + shadcn/ui |
| State | Zustand + TanStack Query |
| Forms | React Hook Form + zod |
| Charts | Recharts |
| Graphes | React Flow (topologie) |
| Terminal | xterm.js |
| Auth | Clerk ou Supabase Auth |
| WebSocket | native + reconnecting-websocket |

### 11.4 ARC Cloud (backend SaaS)
| Couche | Outil |
|---|---|
| Framework | Next.js 15 (API routes) ou Hono |
| BDD | Postgres (Supabase managed ou self) |
| ORM | Drizzle |
| Auth | Clerk |
| Billing | Stripe |
| Email | Resend |
| Storage | Cloudflare R2 |
| Queue | Inngest ou BullMQ |
| Search | Postgres FTS ou Meilisearch |

### 11.5 Marketplace
| Couche | Outil |
|---|---|
| Templates registry | GitHub Container Registry + custom CDN |
| Storage assets | Cloudflare R2 |
| Validation | Custom scanner (Trivy + custom rules) |

### 11.6 AI Copilot Sentinel
| Couche | Outil |
|---|---|
| Orchestration | LangGraph (déjà éprouvé par Johann) |
| Models | Claude Sonnet (premium), GPT-4o (premium), Ollama (free) |
| Tool routing | Function calling natif |
| Memory | Postgres + pgvector |
| Streaming | Vercel AI SDK |

---

## 12. Sécurité, conformité, légal

### 12.1 Sécurité produit
- TLS partout (Cloudflare + Let's Encrypt).
- Auth Clerk avec MFA obligatoire pour admin/owner.
- API keys scopées + rotation.
- Audit log de toutes les actions sensibles.
- Secrets jamais loggés ni envoyés à ARC Cloud.

### 12.2 Conformité légale
- **RGPD** : DPA disponible, sous-traitants documentés, droit à l'effacement.
- **CGU + CGV** rédigées par avocat (à budgéter).
- **Mentions légales** complètes.
- Cookies : bannière conforme RGPD via Cookiebot ou similaire.

### 12.3 Open source & licences

| Composant | Licence |
|---|---|
| CLI `arc` | Apache 2.0 (open-source) |
| ARC Agent | Apache 2.0 |
| Dashboard self-hosted | Apache 2.0 |
| ARC Cloud (backend SaaS) | Closed source |
| Marketplace templates | Apache 2.0 par défaut, custom pour premium |

### 12.4 Attribution Coolify et upstream
ARC est un **intégrateur**. README contient :
- Attribution claire à Coolify, `local-ai-packaged`, Ollama, Supabase.
- Sponsoring GitHub ouvert vers ces projets.
- Engagement à contribuer upstream quand pertinent.

### 12.5 Trademark
- ✅ Trademark "EuglowLabs ARC" (à déposer INPI/EUIPO si traction).
- ❌ Jamais utiliser "Coolify" ni leur logo dans la marque ARC.
- ✅ "Built on Coolify" comme attribution est OK.

---

## 13. Modèle économique

### 13.1 Plans

| Plan | Prix | Cible | Inclus |
|---|---|---|---|
| **Hobby** | Gratuit | Individus, étudiants | CLI + Dashboard self-hosted, 1 VPS, communauté |
| **Pro** | 12 €/mois | Solo founders | Cloud features, Sentinel (Ollama), 3 VPS, marketplace |
| **Team** | 40 €/mois | Petites agences | 10 VPS, Sentinel premium, multi-user (5), priority email |
| **Business** | 120 €/mois | Agences moy. | 25 VPS, multi-user (15), SLA 99.5%, audit logs export |
| **Enterprise** | Sur devis | Grandes orgs | VPS illimités, SSO, SLA 99.9%, support dédié, on-prem ARC Cloud |

### 13.2 Marketplace revenue share
- Templates gratuits : pas de revenu.
- Templates premium vendus par tiers : **70% créateur / 30% ARC**.
- Templates premium "EuglowLabs official" : **100% EuglowLabs**.

### 13.3 Sources de revenus prévisionnelles (an 1)

| Source | Hypothèse | Revenu mensuel cible (mois 12) |
|---|---|---|
| Plans Pro | 200 users × 12 € | 2 400 € |
| Plans Team | 30 users × 40 € | 1 200 € |
| Plans Business | 5 users × 120 € | 600 € |
| Marketplace | 100 templates premium × 5 €/mois × 30% | 150 € |
| **Total mois 12** | | **~4 350 €/mois** |

Hypothèses conservatrices : conversion 5% des users gratuits → payants après 6 mois. Croissance organique via produit + r/selfhosted + Indie Hackers.

### 13.4 Coûts de structure
- Infra ARC Cloud : ~50-100 €/mois (Hetzner + Cloudflare + Stripe fees)
- Outils (Linear, Resend, Sentry) : ~50 €/mois
- Domaines + trademarks : ~200 €/an
- AI inference (Sentinel premium) : variable selon usage, capé par plan
- Légal (avocat one-shot CGU/CGV) : ~1500 € one-shot

### 13.5 Path to ramen profitability
Objectif : **3000 €/mois de MRR au mois 12** = ramen profitability solo founder.

---

## 14. Roadmap & phases

### Phase 0 — Validation (1 mois)
- [ ] Spec produit complète (ce document)
- [ ] Landing page placeholder + waitlist (arc.euglowlabs.com)
- [ ] Posts r/selfhosted + Indie Hackers + Twitter pour valider l'intérêt
- [ ] 50+ inscrits waitlist = signal go

### Phase 1 — MVP CLI (1 mois)
- [ ] CLI `arc` Phase A-C (cf. spec infra v2.0 §16)
- [ ] Dogfood sur l'infra perso de Johann
- [ ] Migration EuglowLabs + InfinixUI depuis Vercel
- [ ] Repo public sur GitHub avec README solide
- [ ] Annonce sur r/selfhosted et IH

### Phase 2 — Dashboard Niveau 1 (1 mois)
- [ ] ARC Agent en Go (basique : status + logs + metrics)
- [ ] Dashboard self-hosted Next.js
- [ ] Pages /overview, /projects, /projects/[id], /ai-stack
- [ ] Auth simple (single-user)
- [ ] Release v0.2 open-source

### Phase 3 — Dashboard Niveau 2 (2 mois)
- [ ] /topology avec React Flow
- [ ] /business avec calculs économies
- [ ] /sandbox audit
- [ ] /compliance config diff
- [ ] /cross-env
- [ ] Notifications Discord/email
- [ ] Release v0.5

### Phase 4 — ARC Cloud MVP (2 mois)
- [ ] Backend Next.js + Postgres + Clerk + Stripe
- [ ] Multi-tenant (orgs, users, permissions)
- [ ] Connexion VPS ↔ ARC Cloud via ARC Agent
- [ ] Plans Hobby + Pro
- [ ] Lancement payant beta (waitlist)

### Phase 5 — AI Copilot Sentinel (1.5 mois)
- [ ] Architecture LangGraph
- [ ] Tools : status, logs, metrics, deploy, restart
- [ ] UI chat dans dashboard
- [ ] Self-hosted (Ollama) pour plan Hobby
- [ ] Premium (Claude/GPT-4) pour plans Pro+

### Phase 6 — Marketplace (1.5 mois)
- [ ] Schema templates + validation
- [ ] UI marketplace dans dashboard
- [ ] Submit / review workflow
- [ ] Billing premium templates (Stripe Connect)
- [ ] 20 templates "officiels EuglowLabs" au lancement

### Phase 7 — API publique & SDKs (1 mois)
- [ ] REST API + WS streaming
- [ ] OpenAPI doc
- [ ] SDK TypeScript
- [ ] Webhooks
- [ ] Tutos d'intégration

### Phase 8 — Polish & growth (continue)
- [ ] Tests E2E sur VPS de test
- [ ] Documentation complète (Astro Starlight)
- [ ] Vidéos YouTube (Johann a déjà la chaîne)
- [ ] Programme partenaires agences
- [ ] Plans Team + Business

**Total estimé Phase 1 → Phase 7 : ~10-12 mois en solo.**

---

## 15. KPIs & métriques de succès

### 15.1 Produit
- **Time-to-first-deploy** : < 15 min depuis l'install
- **Daily active VPS managed** : croissance MoM
- **NPS** : > 50

### 15.2 Adoption
- **Inscrits waitlist** (M1) : > 500
- **Users gratuits** (M3) : > 1000
- **GitHub stars** (M6) : > 2000
- **Users payants** (M12) : > 250

### 15.3 Business
- **MRR** (M12) : > 3 000 €
- **Churn mensuel** : < 5%
- **CAC** (acquisition) : < 30 € via organique
- **LTV/CAC ratio** : > 3

### 15.4 Communauté
- **Discord members** (M6) : > 500
- **Templates marketplace** (M12) : > 100
- **Contributeurs externes** (M12) : > 20

---

## 16. Risques & mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| **Coolify pivote sa licence** (Apache → BSL) | Faible | Élevé | Fork défensif si nécessaire ; ne pas se rendre dépendant à 100% |
| **Vercel/Railway lance équivalent self-hosted** | Moyenne | Élevé | Avantage IA + multi-tenant ; communauté loyale |
| **Concurrence d'un autre wrapper Coolify** | Moyenne | Moyen | Speed of execution + qualité dashboard + IA |
| **Solo founder burnout** | Élevée | Critique | Roadmap réaliste, dogfood d'abord, OSS pour traction |
| **Faible conversion gratuit → payant** | Moyenne | Élevé | Lifecycle emails, AI Copilot comme killer feature payante |
| **Failles sécurité ARC Agent** | Moyenne | Critique | Audit externe avant lancement payant ; bug bounty |
| **Coût AI inference (Sentinel)** | Moyenne | Moyen | Cap par plan ; Ollama par défaut sur Hobby |
| **Complexité d'opérer un SaaS multi-tenant solo** | Élevée | Élevé | Stack managé (Vercel + Supabase + Stripe) ; pas d'ironie d'auto-héberger ARC Cloud au début |

### 16.1 Note ironique sur le bootstrap
ARC Cloud (le SaaS) sera initialement hébergé sur **Vercel + Supabase managed** plutôt que sur ARC self-hosted. Pour des raisons de fiabilité initiale et de focus produit. La migration vers ARC self-hosted une fois mature sera **un excellent cas d'étude marketing**.

---

## 17. Annexes

### 17.1 Glossaire

| Terme | Définition |
|---|---|
| **ARC** | Autonomous Resource Cloud — le produit |
| **CLI `arc`** | Outil ligne de commande pour bootstrap & ops |
| **ARC Agent** | Service Go installé sur chaque VPS managé |
| **ARC Dashboard** | UI Next.js de supervision |
| **ARC Cloud** | Backend SaaS multi-tenant (euglowlabs) |
| **Sentinel** | AI Copilot intégré au dashboard |
| **Marketplace** | Bibliothèque de templates one-click |
| **Template** | Bundle déployable (compose + manifest + assets) |

### 17.2 Naming

| Composant | Nom |
|---|---|
| Produit global | EuglowLabs ARC |
| CLI binary | `arc` |
| Repo CLI | `euglowlabs/arc-cli` |
| Repo Agent | `euglowlabs/arc-agent` |
| Repo Dashboard | `euglowlabs/arc-dashboard` |
| Repo Cloud (privé) | `euglowlabs/arc-cloud` |
| Domaine | `arc.euglowlabs.com` |
| Doc | `docs.arc.euglowlabs.com` |
| Discord | discord.gg/euglowlabs-arc |

### 17.3 Critères go/no-go par phase

**Go-to-Phase 2 si Phase 1 atteint :**
- > 100 GitHub stars
- > 50 users actifs sur le CLI
- Feedback qualitatif positif (NPS > 30)

**Go-to-Phase 4 (paid) si Phase 3 atteint :**
- > 500 users du dashboard self-hosted
- > 10 demandes spontanées pour features cloud
- Roadmap claire validée par early users

### 17.4 Liens & références
- Spec infra : `spec-infra-selfhosted-v2.md`
- Coolify : github.com/coollabsio/coolify (Apache 2.0)
- local-ai-packaged : github.com/coleam00/local-ai-packaged
- Marché self-hosted : r/selfhosted, awesome-selfhosted
- Inspiration UX : Vercel dashboard, Linear, Railway

---

**Fin de la spec — v1.0**

*Ce document est une vision produit exhaustive. Il est destiné à évoluer après chaque phase d'implémentation, basé sur les retours utilisateurs et les apprentissages dogfood.*
