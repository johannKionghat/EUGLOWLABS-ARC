# Glossaire — EuglowLabs ARC

Vocabulaire du domaine. Quand un terme apparaît capitalisé dans la documentation ou le code, c'est qu'il est défini ici.

## Produit

- **EuglowLabs ARC** — Le produit complet (Autonomous Resource Cloud). Plateforme self-hosted "Vercel + Supabase + Ollama-like" déployable en une commande, avec cockpit unifié.
- **ARC** — Acronyme de Autonomous Resource Cloud. Toujours en majuscules.
- **EuglowLabs** — La société (et marque parente) qui édite ARC.

## Composants

- **CLI `arc`** — Outil ligne de commande pour bootstrap, deploy, backup, migrate. Single binary distribué via npm, Homebrew, curl install. Stack : Bun + clipanion + zod.
- **ARC Agent** — Service Go installé sur chaque VPS managé. Expose une API authentifiée et un WebSocket pour permettre au Dashboard de superviser le VPS.
- **ARC Dashboard** — UI Next.js 15 de supervision. Self-host (gratuit) ou cloud (payant). Trois niveaux : status page, cockpit avancé, multi-tenant.
- **ARC Cloud** — Backend SaaS multi-tenant hébergé par EuglowLabs (`arc.euglowlabs.com`). Auth, billing, marketplace, AI Copilot premium. Closed source.
- **Sentinel** — AI Copilot intégré au Dashboard. Diagnostique, agit et explique l'état de la stack en langage naturel.
- **Marketplace** — Bibliothèque de templates one-click (apps, agents IA, workflows n8n, stacks complètes). Publication communautaire, premium possible.

## Concepts techniques

- **`arc.config.yml`** — Fichier déclaratif source de vérité pour l'infrastructure d'un utilisateur. Versionné dans Git. Contient `target`, `domain`, `provider`, `dns`, `stack`, `projects`. Validé par zod côté CLI.
- **target** — Champ de `arc.config.yml`. Vaut `local` ou `vps`. Bascule entre exécution locale (WSL2/macOS/Linux + Cloudflare Tunnel) et exécution distante (VPS Hetzner + DNS A + Let's Encrypt). 95% du code est partagé entre les deux modes.
- **LocalAdapter / VPSAdapter** — Implémentations du pattern adapter qui isole la couche d'exécution (commandes locales via `execa` vs commandes distantes via `node-ssh`). Cf. ADR-0009.
- **Template** — Bundle déployable (compose + manifest `arc-template.yml` + assets) listé sur le marketplace.
- **Org / Organization** — Conteneur multi-tenant dans ARC Cloud. Regroupe utilisateurs et VPS. Permissions : owner, admin, member, viewer.

## Réseaux Docker

Trois réseaux isolés. Cf. ADR-0008.

- **`prod_net`** — Réseau des apps utilisateur en production (Coolify-managées) et des outils ops (Uptime Kuma). Vert. Accès internet ✅.
- **`ai_net`** — Réseau de la stack IA (Ollama, OpenClaw, DeepAgents) et des services partagés (Postgres/Supabase, n8n, Langfuse). Bleu. Accès internet ✅.
- **`sandbox_net`** — Réseau d'exécution isolée du code généré. Rouge. **`internal: true`** : aucun accès internet, aucun accès aux autres réseaux. Containers durcis (`read_only`, `cap_drop: [ALL]`, limites RAM/CPU).

## Dépendances upstream

- **Coolify** — PaaS open-source (Apache 2.0) utilisé par ARC comme dépendance. Fournit deploy Git, SSL Let's Encrypt, gestion env vars, intégration Traefik. **Jamais forké** par ARC. Cf. ADR-0005.
- **Dokploy** — Alternative à Coolify, plus légère. Supportée comme adapter optionnel pour les VPS contraints en RAM.
- **`local-ai-packaged`** — Bundle Docker Compose communautaire (`coleam00/local-ai-packaged`) intégrant Ollama, Supabase, n8n, Open WebUI, Qdrant, Neo4j, Flowise, Langfuse, SearXNG, Caddy. Déployé tel quel par `arc deploy`.
- **OpenClaw** — AI gateway open-source (routing modèles, fallback cloud) ajouté à `ai_net` par compose maison.
- **DeepAgents** — Framework d'orchestration d'agents IA ajouté à `ai_net` + `sandbox_net`.
- **Cloudflare Tunnel** — Tunnel HTTPS public utilisé en mode `target: local` pour exposer la machine de dev sans port forward.

## Plans & business

- **Hobby** — Plan gratuit (CLI + Dashboard self-hosted, 1 VPS, communauté).
- **Pro** — 12 €/mois, solo founders, cloud features + Sentinel Ollama + 3 VPS.
- **Team** — 40 €/mois, petites agences, 10 VPS + Sentinel premium + multi-user.
- **Business** — 120 €/mois, agences moyennes, SLA 99.5%.
- **Enterprise** — Sur devis, SSO, SLA 99.9%, on-prem ARC Cloud possible.
