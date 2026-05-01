---
description: Initialise toute l'organisation projet EuglowLabs ARC (CLAUDE.md, ADRs, tasks, conventions, structure docs)
argument-hint: [chemin-spec-infra] [chemin-spec-arc]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Bootstrap complet du projet EuglowLabs ARC

Tu es chargé d'initialiser **l'organisation complète** du projet **EuglowLabs ARC** (Autonomous Resource Cloud).
Tu ne vas PAS écrire de code applicatif. Tu vas uniquement créer la **structure documentaire et organisationnelle** qui permettra à Claude Code de bosser proprement sur ce projet pendant des mois sans dériver.

## Inputs attendus

L'utilisateur a placé deux specs dans le projet :
- Spec infra : `$1` (par défaut `docs/01-spec-infra.md`)
- Spec produit : `$2` (par défaut `docs/02-spec-arc-product.md`)

Si `$1` ou `$2` ne sont pas fournis, demande où sont les specs. Si elles ne sont pas dans `docs/`, demande à l'utilisateur de les placer là d'abord.

## Phase 0 — Vérifications préalables

1. Vérifie qu'on est bien à la racine d'un repo git (`git rev-parse --show-toplevel`)
2. Vérifie que `.claude/` existe
3. Vérifie que les deux specs existent et lis-les **intégralement**
4. Si un fichier `CLAUDE.md` existe déjà à la racine, ARRÊTE et demande confirmation avant d'écraser

## Phase 1 — Lecture et synthèse

Lis les deux specs en entier. Extrais :
- Les **décisions techniques structurantes** (stack, langages, frameworks)
- Les **invariants** (règles non-négociables)
- Les **composants** du système et leurs frontières (CLI `arc`, ARC Agent, ARC Dashboard, ARC Cloud, Sentinel, Marketplace)
- Les **phases** de la roadmap (8 phases dans la spec produit)
- Le **vocabulaire** spécifique au projet EuglowLabs ARC

Construis une compréhension globale **avant** de générer quoi que ce soit.

## Phase 2 — Génération de la structure

Crée exactement cette arborescence :

```
docs/
├── 00-overview.md
├── 03-architecture-decisions/
│   ├── README.md
│   ├── 0001-monorepo-turborepo.md
│   ├── 0002-bun-runtime-cli.md
│   ├── 0003-go-for-arc-agent.md
│   ├── 0004-nextjs-15-app-router.md
│   ├── 0005-coolify-as-dependency-not-fork.md
│   ├── 0006-apache-2-license-oss.md
│   ├── 0007-postgres-shared-via-supabase.md
│   ├── 0008-three-network-isolation.md
│   ├── 0009-dual-target-local-vps.md
│   └── 0010-clerk-stripe-supabase-cloud.md
├── 04-conventions/
│   ├── coding-style.md
│   ├── naming.md
│   ├── git-workflow.md
│   ├── testing.md
│   └── pr-review.md
└── 05-glossary.md

tasks/
├── INDEX.md
├── current.md
├── completed/
│   └── .gitkeep
└── backlog/
    └── .gitkeep

CLAUDE.md
.gitignore (mise à jour si existe, création sinon)
```

## Phase 3 — Contenu de chaque fichier

### `CLAUDE.md` (racine)

Ce fichier est CRITIQUE. Claude Code le lit à chaque session. Il doit :

1. **Commencer par** : `# CLAUDE.md — EuglowLabs ARC`
2. Identifier le projet : EuglowLabs ARC = Autonomous Resource Cloud, produit de EuglowLabs
3. Référencer les deux specs comme source de vérité
4. **"Avant toute action"** : checklist de fichiers à lire (CLAUDE.md, tasks/current.md, ADRs concernés, conventions)
5. **Règles non-négociables** : ce qui ne se discute jamais (TS strict, no any, tests obligatoires, 1 PR = 1 tâche < 2h, jamais forker Coolify, jamais modifier 2 packages dans la même PR)
6. **Stack figée** : technologies choisies (extraite des ADRs : Turborepo, Bun, Go, Next.js 15, etc.)
7. **Workflow par tâche** : étapes obligatoires (lire current.md → proposer plan → attendre go → coder sous-tâche par sous-tâche → tests verts → commit atomique → archiver tâche)
8. **Limites de scope** : si > 5 fichiers modifiés, ARRÊTER ; si feature non spec, ARRÊTER ; si décision manquante, écrire ADR draft
9. **Référence aux ADRs et au glossaire**
10. **Naming des composants** : CLI = `arc`, monorepo = `euglowlabs-arc`, packages = `@euglowlabs/arc-*`

Le fichier doit faire entre 80 et 150 lignes. Pas plus. Concis et actionnable.

### `docs/00-overview.md`

Une page de synthèse :
- Vision EuglowLabs ARC en 3 phrases
- Composants principaux (CLI `arc`, ARC Agent, ARC Dashboard, ARC Cloud, Sentinel, Marketplace)
- Schéma ASCII de l'architecture globale (extrait depuis la spec produit §3.2)
- Liens vers les specs détaillées
- Liens vers les phases de roadmap

Max 80 lignes.

### `docs/03-architecture-decisions/README.md`

Explique le format ADR. Inclut un template :

```markdown
# ADR-XXXX : Titre court

## Statut
[Proposé | Accepté | Déprécié | Superseded by ADR-YYYY]
Date : YYYY-MM-DD

## Contexte
Quel problème ? Quelles contraintes ?

## Décision
LA décision, sans détours.

## Conséquences
+ Bénéfices
- Compromis acceptés

## Alternatives rejetées
Pourquoi pas X, Y, Z.
```

### Les 10 ADRs

Pour CHAQUE ADR, suis le contenu attendu :

- **0001-monorepo-turborepo** : Pourquoi Turborepo + pnpm workspaces pour le monorepo `euglowlabs-arc`. Alternatives rejetées : Nx (overkill solo founder), polyrepos (perte de cohérence entre CLI / Agent / Dashboard / Cloud).

- **0002-bun-runtime-cli** : Pourquoi Bun pour le CLI `arc`. Conséquence : single binary natif via `bun build --compile`. Alternatives : Node + pkg (plus maintenu), Deno (compat npm moindre, SDK Hetzner non testé).

- **0003-go-for-arc-agent** : Pourquoi Go pour ARC Agent. Binaire léger ~10Mo, pas de runtime, idéal pour service installé sur N VPS managés. Alternatives : Node (lourd), Rust (overkill, courbe apprentissage).

- **0004-nextjs-15-app-router** : Pourquoi Next.js 15 pour ARC Dashboard et ARC Cloud. App Router stable, RSC, déployable Vercel et self-host. Cohérent avec l'écosystème EuglowLabs.

- **0005-coolify-as-dependency-not-fork** : RÈGLE CRUCIALE. EuglowLabs ARC utilise Coolify mais ne le forke jamais. Attribution upstream visible, contributions encouragées, jamais de rebrand. Référence : philosophie Coolify (Apache 2.0 mais demande éthique).

- **0006-apache-2-license-oss** : CLI `arc`, ARC Agent, ARC Dashboard sous Apache 2.0. ARC Cloud (backend SaaS multi-tenant) closed-source. Modèle économique inspiré Plausible / PostHog.

- **0007-postgres-shared-via-supabase** : Une instance Postgres via Supabase self-hosted (depuis `local-ai-packaged`), une database par projet. Pas une instance Supabase complète par projet (trop lourd).

- **0008-three-network-isolation** : Trois réseaux Docker isolés : `prod_net`, `ai_net`, `sandbox_net`. Le réseau sandbox_net est marqué `internal: true` (pas d'accès internet, pas d'accès aux autres réseaux). Sécurité au cœur de l'architecture EuglowLabs ARC.

- **0009-dual-target-local-vps** : Le champ `target` du fichier `arc.config.yml` bascule entre `local` et `vps`. 95% du code partagé entre les deux modes. Pattern adapter (`LocalAdapter` vs `VPSAdapter`). Cloudflare Tunnel utilisé en mode local pour avoir des URLs publiques HTTPS.

- **0010-clerk-stripe-supabase-cloud** : ARC Cloud (backend SaaS) utilise services managés (Clerk auth, Stripe billing, Supabase managed Postgres) au lancement. Auto-héberger ARC Cloud sur EuglowLabs ARC self-hosted = cas d'étude futur, pas day-one.

Chaque ADR fait entre 30 et 60 lignes. Ne sois ni trop bref (manque de contexte) ni trop verbeux.

### `docs/04-conventions/coding-style.md`

Règles strictes :
- TypeScript : strict mode, `noUncheckedIndexedAccess`, zéro `any` sauf justification commentée
- Imports : ordre absolu (deps externes → internes monorepo `@euglowlabs/arc-*` → relatifs)
- Naming : kebab-case fichiers, PascalCase composants, camelCase fonctions
- Pas de default exports sauf pour pages Next.js
- Toute fonction publique a un JSDoc
- Pas de console.log committé

Code Go (pour ARC Agent) :
- gofmt obligatoire
- Erreurs jamais ignorées
- Pas de panic() en production
- Comments godoc sur les publics

### `docs/04-conventions/naming.md`

- Tâches : `[SCOPE]-NNN` (ex: `CLI-042`, `DASH-007`, `AGENT-013`, `CLOUD-021`)
- Branches : `feat/CLI-042-add-deploy-command`
- Commits : Conventional Commits avec ID tâche (`feat(cli): add deploy command [CLI-042]`)
- Repos potentiels (si on split plus tard) : `arc-cli`, `arc-agent`, `arc-dashboard`, `arc-cloud`
- Packages npm : `@euglowlabs/arc-cli`, `@euglowlabs/arc-shared`, etc.
- Binary CLI : `arc` (pas `euglowlabs-arc` en CLI, trop long)

### `docs/04-conventions/git-workflow.md`

- Trunk-based, branches courtes
- 1 PR = 1 tâche = max 2h de travail
- Tests verts obligatoires avant merge
- Squash merge
- Pas de force-push sur main

### `docs/04-conventions/testing.md`

- Vitest pour TS/JS unit + integration
- Playwright pour E2E ARC Dashboard
- Go testing standard pour ARC Agent
- Coverage minimum : 70% sur logique métier
- Tests E2E sur VPS de staging avant merge

### `docs/04-conventions/pr-review.md`

Checklist auto-revue avant ouverture PR :
- [ ] Tests verts en local
- [ ] Lint passe
- [ ] Pas de console.log / debug
- [ ] Documentation à jour si API publique modifiée
- [ ] ADR mis à jour si décision structurante changée
- [ ] Tâche déplacée vers `tasks/completed/`

### `docs/05-glossary.md`

Extrais les termes du domaine depuis les specs. Format : terme + définition en 1-2 phrases.

Termes à inclure obligatoirement :
- **EuglowLabs ARC** : le produit complet (Autonomous Resource Cloud)
- **CLI `arc`** : outil ligne de commande pour bootstrap & ops
- **ARC Agent** : service Go installé sur chaque VPS managé
- **ARC Dashboard** : UI Next.js de supervision
- **ARC Cloud** : backend SaaS multi-tenant hébergé par EuglowLabs
- **Sentinel** : AI Copilot intégré au dashboard
- **Marketplace** : bibliothèque de templates one-click
- **target** : champ du config qui bascule local ↔ vps
- **prod_net / ai_net / sandbox_net** : les trois réseaux Docker isolés
- **Coolify** : PaaS open-source utilisé comme dépendance (jamais forké)
- **local-ai-packaged** : bundle Docker Compose communautaire intégrant Ollama, Supabase, n8n, etc.
- **arc.config.yml** : fichier déclaratif source de vérité pour l'infra

### `tasks/INDEX.md`

Vue d'ensemble de TOUTES les tâches du projet, organisées par phase.

Structure :

```markdown
# INDEX des tâches — EuglowLabs ARC

## Légende
- ⬜ Non commencée
- 🟡 En cours
- ✅ Terminée
- 🔴 Bloquée

## Phase 0 — Setup (semaine 1)
- ⬜ INFRA-001 — Setup monorepo Turborepo
- ⬜ INFRA-002 — Config Biome + Vitest
...

## Phase 1 — CLI MVP (semaines 2-4)
- ⬜ CLI-001 — Squelette clipanion + commande version
...

## Phase 2 — ARC Agent (semaines 5-6)
- ⬜ AGENT-001 — ...
...

## Phase 3 — Dashboard Niveau 1 (semaines 7-9)
...

## Phase 4 — ARC Cloud MVP (semaines 10-13)
...

## Phase 5 — Sentinel AI Copilot
...

## Phase 6 — Marketplace
...

## Phase 7 — API publique & SDKs
...

## Phase 8 — Polish & growth
...
```

Génère **environ 60-80 tâches** réparties sur les 8 phases issues de la spec produit `docs/02-spec-arc-product.md` §14. Chaque tâche doit être **estimable < 2h**. Si tu hésites, découpe.

### `tasks/current.md`

Initialise avec la première tâche : INFRA-001. Format :

```markdown
# Tâche en cours : INFRA-001 — Setup monorepo Turborepo

## Objectif
Initialiser la structure Turborepo du monorepo `euglowlabs-arc` avec pnpm workspaces
et les 5 packages prévus (arc-cli, arc-agent, arc-dashboard, arc-cloud, arc-shared).

## Critères d'acceptation
- [ ] `pnpm install` fonctionne sans warning
- [ ] `pnpm build` passe sur les 5 packages (placeholders OK)
- [ ] `pnpm test` lance Vitest sans erreur
- [ ] CI GitHub Actions verte sur PR

## Fichiers à créer
- package.json (root, name: "euglowlabs-arc")
- pnpm-workspace.yaml
- turbo.json
- biome.json
- packages/arc-cli/package.json (name: "@euglowlabs/arc-cli")
- packages/arc-agent/ (placeholder, code Go viendra plus tard)
- packages/arc-dashboard/package.json (name: "@euglowlabs/arc-dashboard")
- packages/arc-cloud/package.json (name: "@euglowlabs/arc-cloud")
- packages/arc-shared/package.json (name: "@euglowlabs/arc-shared")
- .github/workflows/ci.yml

## ADRs liés
- ADR-0001 : Monorepo Turborepo

## NE PAS faire dans cette tâche
- Pas de logique métier
- Pas de dépendances applicatives (zod, drizzle, etc.)
- Pas de Dockerfile

## Scratchpad (Claude met à jour pendant le travail)
À remplir au fur et à mesure.
```

### `.gitignore`

Ajouter (ou créer) :
```
node_modules/
dist/
.turbo/
.next/
*.log
.env
.env.local
.DS_Store
.infra/
coverage/
```

## Phase 4 — Validation finale

Une fois tous les fichiers créés :

1. Liste tous les fichiers créés avec leur taille en lignes
2. Vérifie que `CLAUDE.md` fait < 150 lignes (sinon trop verbeux)
3. Vérifie que chaque ADR fait entre 30 et 60 lignes
4. Vérifie que `tasks/INDEX.md` a au moins 60 tâches
5. Affiche un résumé en français avec :
   - Ce qui a été créé pour le projet **EuglowLabs ARC**
   - Le nombre total de tâches générées
   - Comment démarrer la première tâche (instruction claire à l'utilisateur)
   - Combien de temps Claude estime pour la Phase 0 complète

## Règles ABSOLUES

- Tu ne crées AUCUN fichier `.ts`, `.tsx`, `.go`, `.json` applicatif. Que de la doc et de l'organisation.
- Tu ne fais PAS `pnpm install` ni `git add`. L'utilisateur garde la main.
- Si tu as un doute sur une décision, ÉCRIS l'ADR comme "Proposé" plutôt que "Accepté", et signale-le en fin de résumé.
- Tu suis EXACTEMENT la structure demandée. Si quelque chose te semble manquant, tu le mentionnes en fin de résumé, tu n'inventes pas de section.
- Le nom du projet est **EuglowLabs ARC**. Pas "ARC". Pas "arc-monorepo". **EuglowLabs ARC**. Le binary CLI s'appelle `arc`. Le repo / dossier s'appelle `euglowlabs-arc`. Les packages npm sont `@euglowlabs/arc-*`.