# ADR-0013 : Strict Chantier 1 / Chantier 2 separation

## Statut
Accepté
Date : 2026-05-03

## Contexte

La spec produit (`docs/02-spec-arc-product.md`) couvre **trois niveaux** de produit :
- Niveau 1 : Status page agrégée (CLI + Dashboard self-hosted + ARC Agent)
- Niveau 2 : Cockpit avancé (topologie, business metrics, sandbox audit, cross-env, compliance)
- Niveau 3 : Plateforme SaaS multi-tenant (auth, billing, marketplace, AI Copilot Sentinel, API publique, SDKs, plugins)

L'utilisateur (solo founder) **risque le scope creep** : commencer le SaaS multi-tenant avant d'avoir un produit utilisable single-machine. Toutes les startups infra qui réussissent ont d'abord livré un binaire qui marche, *puis* construit la couche SaaS dessus (Coolify → Coolify Cloud, PostHog OSS → PostHog Cloud, Plausible self-hosted → Plausible.io). L'inverse a un taux d'échec élevé.

L'utilisateur veut figer cette séquence dans un ADR pour qu'aucun agent (humain ou LLM) ne démarre une tâche Chantier 2 par inadvertance.

## Décision

EuglowLabs ARC est découpé en **deux chantiers strictement séquentiels**.

### 🔨 Chantier 1 — actif, à finir avant tout

Périmètre :

1. **CLI `arc`** — toutes les commandes self-hosted single-machine :
   - `init`, `setup`, `deploy`, `status`, `logs`, `restart`, `backup`, `restore`, `destroy`, `version`, `help`, `config telemetry`.
   - Pas de `migrate` (supprimé par ADR-0012). Workflow `backup → scp → restore` documenté à la place.
2. **Stack déployée** sur la machine cible :
   - Coolify (installé via son installer officiel, jamais forké — ADR-0005)
   - `local-ai-packaged` (bundle communautaire)
   - Compose maison sandbox (réseau `internal: true`, ADR-0008)
   - Compose maison agents (OpenClaw + DeepAgents)
   - Uptime Kuma + monitoring local
3. **Dashboard self-hosted Niveau 1** — Next.js, déployé sur la machine ARC :
   - Pages `/overview`, `/projects`, `/projects/[id]`, `/ai-stack`, `/settings`
   - Auth single-user (mot de passe via env, JWT)
   - Pas de page `/cross-env` (déplacée Chantier 2 — ADR-0012 §"Conséquences")
   - Pas de page `/business`, `/topology`, `/sandbox`, `/compliance` (ce sont des features Niveau 2 — déplacées Chantier 2)
4. **ARC Agent en Go** :
   - HTTP server local exposant l'API consommée par le Dashboard
   - WebSocket pour metrics live
   - **Auth en Chantier 1 = token local statique généré par `arc setup`.** Pas d'enregistrement auprès d'ARC Cloud, pas de token rotatif Cloud-signed.
   - Bind/port configurés via `arc.config.yml` (`agent: { bind, port }`)
5. **Tests E2E + documentation** :
   - Test bout-en-bout sur VM jetable (E2E-001)
   - `docs/migration-guide.md` (DOC-001 — 6 sections : migrer Next.js + Postgres, déplacer une instance, dupliquer en staging, install sans IP publique, rollback, troubleshooting)
   - README à jour, quickstart en moins de 15 min

> **Important — Migrations des 4 projets de l'auteur ≠ Chantier 1.**
>
> Les migrations d'EuglowLabs.com, InfinixUI, InfinixLoop et EduMatch sont des **actes d'utilisation post-livraison**, pas des tâches de développement. Vercel ne livre pas en migrant les sites de ses clients. Voir ADR-0011 §"Important — Migration des projets ≠ critère de livraison".

### 🧊 Chantier 2 — gelé jusqu'à validation explicite

Périmètre **interdit** tant que je n'ai pas envoyé le message exact `"go chantier 2"` dans la conversation :

1. **ARC Cloud** — backend SaaS multi-tenant
   - Schéma Drizzle multi-tenant (Org, User, Membership, VPS, ApiKey)
   - Endpoint `POST /v1/vps/register` consommé par `arc cloud connect`
   - Token rotatif signé Cloud-side (au lieu du token local statique de Chantier 1)
2. **Authentification & billing externes**
   - Intégration Clerk (signup, OAuth GitHub/Google, MFA)
   - Stripe (produits Hobby/Pro/Team/Business, webhooks, Customer Portal, Connect)
   - Resend (emails transactionnels)
3. **AI Copilot Sentinel**
   - Architecture LangGraph (planner + tools)
   - Routage modèles Claude/GPT-4/Ollama selon plan
   - Memory pgvector
   - Audit log des actions Sentinel
4. **Marketplace de templates**
   - Schéma `arc-template.yml`
   - Scanner sécurité Trivy + custom rules
   - Page `/marketplace` Dashboard
   - Stripe Connect (revenue share 70/30)
5. **API publique + SDKs**
   - REST + WebSocket sur `api.arc.euglowlabs.com`
   - OpenAPI doc
   - SDK TypeScript `@euglowlabs/arc-sdk`
   - SDK Python `pip install euglowlabs-arc`
   - SDK Go `github.com/euglowlabs/arc-go`
6. **Webhooks externes**
   - `project.deployed`, `service.crashed`, `backup.failed`, `vps.resource_alert`
7. **Plugin system**
   - Plugins dashboard (widgets custom)
   - Plugins CLI (commandes additionnelles)
   - Plugins agent (collecteurs de métriques)
8. **Pages Dashboard Niveau 2 et 3**
   - `/topology` (React Flow)
   - `/business` (calculs économies vs cloud)
   - `/sandbox` (audit gouvernance)
   - `/compliance` (config diff)
   - `/cross-env` (déplacée ici par ADR-0012)
   - `/marketplace`, `/copilot`, `/team`, `/billing`

### Gating Chantier 1 → Chantier 2

Je passe au Chantier 2 **uniquement** quand **les 4 critères suivants sont satisfaits**, dans l'ordre :

1. ✅ Les **25 critères** d'[ADR-0011](./0011-end-to-end-install-acceptance.md) sont validés sur un VPS de test (validation infra Phase 4 + suite E2E E2E-001 + tests Playwright DASH-013).
2. ✅ Le Dashboard self-hosted Niveau 1 tourne sur mon VPS de test, accessible via HTTPS sur un domaine réel.
3. ✅ La doc de migration `docs/migration-guide.md` (DOC-001) est complète et **j'ai exécuté §1 à la main** sur un projet de test, en moins de 30 min.
4. ✅ Je valide explicitement par message `"go chantier 2"` dans la conversation. Sans ce message exact, Chantier 2 reste gelé indéfiniment.

> Les migrations de mes 4 projets réels (EuglowLabs, InfinixUI, InfinixLoop, EduMatch) **ne sont pas dans le gating** — ce sont des actes d'utilisation post-livraison, pas des conditions de livraison. Voir ADR-0011 §"Important".

## Conséquences

### Bénéfices

+ **Pas de scope creep.** Aucune décision Chantier 2 n'est prise tant que Chantier 1 n'est pas validé. Pas de dette technique sur du code SaaS qu'on ne comprend pas encore.
+ **Garantie de livrer un produit utilisable** avant de complexifier. Si je décide d'arrêter au Chantier 1 (par exemple : pas envie de gérer un SaaS), j'ai déjà un produit OSS distribuable.
+ **Pivot facile.** Si le marché ne valide pas le besoin SaaS, j'arrête au Chantier 1 sans jeter de code.
+ **Validation par tests vérifiables.** Les 25 critères ADR-0011 + suite E2E sur VM jetable garantissent que le produit marche **sans dépendre** de mes projets réels — un tiers peut le valider.
+ **Un agent qui a Claude Code ouvert ne peut pas dériver.** La règle "JAMAIS Chantier 2 sans `go chantier 2`" est encodée dans `CLAUDE.md` et auto-applicable.

### Compromis acceptés (et leurs mitigations)

- **Délai avant monétisation possible.** Mitigé : pas d'urgence financière, le Chantier 1 peut tourner sur mon infra perso pendant 6 mois si besoin avant que le SaaS arrive.
- **Risque de perte de motivation entre les deux chantiers.** Mitigé par la satisfaction d'avoir un produit concret en main avant d'attaquer le SaaS — la livraison du CLI + Dashboard + doc = victoire visible suffisante.
- **Page Dashboard `/cross-env` (spec produit §6.3.5) ne sera pas dans le Chantier 1.** Acceptable — cette page présuppose multi-host, donc nécessairement Chantier 2.
- **Page Dashboard `/business` ne sera pas dans le Chantier 1.** Acceptable — c'est du Niveau 2 par design.

### Conséquences négatives non mitigeables

- **Pas de monétisation possible avant validation Chantier 1.** Trade-off explicite et acté.

## Plan opérationnel

1. `tasks/INDEX.md` ne contient **plus que** les phases Chantier 1 (Phase 0 setup, Phase 1 CLI, Phase 1.5 refactor, Phase 2 ARC Agent, Phase 3 Dashboard Niveau 1).
2. Toutes les tâches Chantier 2 (Cloud, Sentinel, Marketplace, API/SDKs) sont déplacées dans `tasks/backlog/chantier-2-deferred/` avec un README `"tâches gelées par ADR-0013, ne pas démarrer"`.
3. `CLAUDE.md` — section `🎯 Mode actuel` en haut + règle non-négociable interdisant de démarrer une tâche `chantier-2-deferred/`.
4. `tasks/CHANTIER-1-VALIDATION.md` — checklist des 4 critères de validation.

## Alternatives rejetées

- **Pas de séparation explicite, on avance organiquement.** Risque connu : scope creep, fatigue, backend SaaS à moitié fait sans CLI utilisable. Modèle qui tue les solo founders.
- **Diviser en plus de chantiers (4-5).** Trop fin, complique la communication. Deux chantiers couvrent bien : "produit utilisable" vs "produit monétisable".
- **Mettre la validation chantier 1→2 dans le code (un test CI qui bloque).** Overkill et peu robuste — le gating humain via message explicite est plus simple et adapté à un repo solo founder.
