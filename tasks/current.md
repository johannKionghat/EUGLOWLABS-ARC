# Tâche : ANSIBLE-001b — Rôles `coolify` + `ai-stack`

## Statut
🟡 En cours — démarrée le 2026-05-06

## Objectif
Compléter le playbook ARC avec les **deux rôles applicatifs centraux** posés au-dessus de `hardening` + `docker` (livrés en 001a) :
- `coolify` — installer Coolify v4.0.0 via leur compose officiel pinné (ADR-0005 : Coolify est une dépendance, jamais un fork). Persistance sous `/opt/coolify/`. Healthcheck retry pour absorber le boot de Postgres + migrations.
- `ai-stack` — déployer le bundle `coleam00/local-ai-packaged` (Ollama + Supabase + n8n + Open WebUI + Qdrant + Neo4j + Flowise + Langfuse + SearXNG + Caddy) en clonant à un commit SHA pinné, puis `docker compose up -d`.

À la fin de 001b, `setup.yml` invoque `roles: [hardening, docker, coolify, ai-stack]`. ANSIBLE-001c finalisera avec `sandbox` (réseaux ADR-0008) + `backups` (cron + rclone R2).

## Critères d'acceptation

- [ ] Arborescence créée sous `packages/arc-cli/playbooks/roles/` :
  ```
  roles/
  ├── coolify/
  │   ├── tasks/main.yml
  │   ├── handlers/main.yml
  │   └── defaults/main.yml
  └── ai-stack/
      ├── tasks/main.yml
      ├── handlers/main.yml
      └── defaults/main.yml
  ```
- [ ] **Rôle `coolify`** :
  - [ ] Compose pulled from GitHub raw, pinné à `v4.0.0` → `/opt/coolify/docker-compose.yml`
  - [ ] Install dir `/opt/coolify/` créé (mode 0755, owner root)
  - [ ] `docker compose up -d` via `community.docker.docker_compose_v2` (collection pinned dans `requirements.yml`)
  - [ ] Healthcheck combiné `curl http://localhost:8000` + `docker compose ps` avec retry 30 × 10s (5 min total)
  - [ ] Coolify gère ses networks internes lui-même (pas de pré-création côté ARC)
  - [ ] Idempotent : second run = `changed=0`
- [ ] **Rôle `ai-stack`** :
  - [ ] Repo `coleam00/local-ai-packaged` cloné à un commit SHA pinné (`2c54191…` ou un SHA validé manuellement) → `/opt/local-ai-packaged/`
  - [ ] `.env.example` copié vers `.env` **uniquement si absent** (first-run only — l'opérateur édite après pour ses secrets)
  - [ ] `docker compose up -d` via `community.docker.docker_compose_v2`
  - [ ] Healthcheck retry 30 × 10s sur Ollama (`http://localhost:11434`) + Supabase Studio (`http://localhost:54323`)
  - [ ] Idempotent : second run = `changed=0`
- [ ] **`playbooks/setup.yml`** mis à jour :
  - [ ] `roles: [hardening, docker, coolify, ai-stack]`
  - [ ] Commentaire d'en-tête mis à jour (« Phase 1.5 — partielle, sandbox/backups à venir »)
- [ ] **Tests** :
  - [ ] `ansible-playbook --syntax-check setup.yml` → exit 0 (V1)
  - [ ] `ansible-lint setup.yml roles/` → **0 violation, profile `production` maintenu** (V2)
  - [ ] `pnpm test` → **144 verts maintenus** (zéro régression, pas de TS modifié) (V3)
- [ ] Lint + typecheck globaux verts (`pnpm lint` + `pnpm typecheck`)
- [ ] **Smoke humain** reporté à E2E-001 — ne PAS exécuter `arc setup --apply` réel sur la WSL (Coolify + 10 services AI = trop lourd, risque de squatter le port 8000 ou autres).

## Fichiers concernés (estimation : 7 fichiers, dont 6 nouveaux)

| Fichier | Action |
|---|---|
| `packages/arc-cli/playbooks/roles/coolify/tasks/main.yml` | création |
| `packages/arc-cli/playbooks/roles/coolify/handlers/main.yml` | création (placeholder ou populé) |
| `packages/arc-cli/playbooks/roles/coolify/defaults/main.yml` | création |
| `packages/arc-cli/playbooks/roles/ai-stack/tasks/main.yml` | création |
| `packages/arc-cli/playbooks/roles/ai-stack/handlers/main.yml` | création (placeholder ou populé) |
| `packages/arc-cli/playbooks/roles/ai-stack/defaults/main.yml` | création |
| `packages/arc-cli/playbooks/setup.yml` | modif (append 2 rôles + header) |

⚠️ **7 fichiers** = sous la limite haute CLAUDE.md (5 par défaut, 8 limite haute pour les rôles Ansible). Si l'un des deux rôles déborde (split en multiples `include_tasks`), STOP et redécoupe en ANSIBLE-001b-bis.

## ADRs liés

- **ADR-0005** — Coolify est une dépendance, jamais un fork. Install via compose officiel pinné (équivalent du « via Docker Compose officiel » mentionné dans l'ADR §1).
- **ADR-0008** — Trois réseaux Docker isolés (`prod_net`, `ai_net`, `sandbox_net`). En 001b, on **ne crée pas** ces réseaux ARC : Coolify et `local-ai-packaged` créent leurs networks internes pour leur propre usage. La création des networks ARC + bridging avec ces stacks se fait en **001c (sandbox)**.
- **ADR-0011** — Critère A4 (`arc setup` idempotent). Critère B-* implicite (Coolify répond sur 8000 + Supabase Studio sur 54323 + Ollama sur 11434, vérifiés en E2E-001).
- **ADR-0012** — Single-machine (`hosts: localhost`, `connection: local` hérité du play global).
- **ADR-0015** — Layout `~/.arc/`. Les rôles 001b écrivent **sous `/opt/`** (root-scoped), **pas** sous `~/.arc/`.

## Conventions à respecter

- `coding-style.md` — YAML 2 espaces, FQCN partout (`ansible.builtin.*`, `community.docker.*`, `community.general.*`).
- `testing.md` — ansible-lint maintient profile `production`. Vitest 144 verts non négociable.
- ADR-0015 — rien sous `~/.arc/`.
- Pattern repris d'ANSIBLE-001a : tags par rôle/sujet (ex: `[coolify, install]`, `[ai-stack, healthcheck]`).

## Hors scope (NE PAS faire)

- Créer les réseaux ARC `prod_net`/`ai_net`/`sandbox_net` (= 001c, rôle `sandbox`).
- Configurer le cron de backup ou rclone R2 (= 001c, rôle `backups`).
- Bridger les services Coolify/AI sur les réseaux ARC (= 001c).
- Templates `.env` sophistiqués avec génération de secrets aléatoires pour `local-ai-packaged` (`.env.example` → `.env` only-if-missing suffit pour 001b ; full env management = futur, scope DOC-001 ou nouvelle tâche).
- Configurer Coolify (root user, GitHub OAuth, project setup) : c'est le job de l'opérateur après `arc setup`, pas du rôle.
- Cloner `local-ai-packaged` ailleurs que `/opt/local-ai-packaged/`.
- Auto-démarrer Coolify ou ai-stack via systemd : `docker compose up -d` + Docker engine `enabled: true` (livré par rôle docker en 001a) suffit pour relance auto au reboot.
- Lancer `arc setup --apply` réel sur la WSL : trop lourd (Coolify + 10 services), risques de conflits ports, smoke runtime = E2E-001 sur VPS jetable.
- Toucher au code TypeScript (zéro régression Vitest attendue).

## Décisions actées avant code

### Sous-tâche 1 — Rôle `coolify` (cadrage C1-C6, validés 2026-05-06)

- **C1 — Source compose** : GitHub raw avec version pinnée (option A). PAS d'installer `curl|sh` (non reproductible), PAS de vendor in-repo (entretien lourd).
- **C2 — Version Coolify** : **`v4.0.0`** (dernière release stable récupérée via GitHub API au démarrage de 001b).
- **C3 — Healthcheck** : combiné `curl localhost:8000` + `docker compose ps` avec retry 30 × 10s. 5 min de budget pour absorber le boot Postgres + migrations Coolify.
- **C4 — Networks Docker** : Coolify les crée via son compose. Pas de pré-création côté rôle ARC.
- **C5 — Persistance** : `/opt/coolify/data` géré par le compose officiel. Pas de custom path.
- **C6 — Variables exposées** dans `defaults/main.yml` (3 vars) :
  - `coolify_version: "v4.0.0"`
  - `coolify_install_dir: "/opt/coolify"`
  - `coolify_compose_url: "https://raw.githubusercontent.com/coollabsio/coolify/{{ coolify_version }}/docker-compose.yml"`

### Sous-tâche 2 — Rôle `ai-stack` (cadrage A1-A8, validés 2026-05-06 sur recommandations par défaut)

- **A1 — Source `local-ai-packaged`** : `git clone` repo upstream `coleam00/local-ai-packaged` (option A). Pas de vendor in-repo.
- **A2 — Pin strategy** : **commit SHA pinné**. Pas de releases publiées par l'auteur (ship from `main`). SHA capturé au démarrage de 001b : `2c541913c0f97d7e2e4de3ee7e3f790fc63ce613` (à confirmer pendant la sous-tâche 2 — peut être réajusté si SHA plus récent jugé plus stable, mais on PIN, pas de `branch: main`).
- **A3 — Install dir** : `/opt/local-ai-packaged/` (root-scoped, ADR-0015 compliant).
- **A4 — `.env` handling** : `cp .env.example .env` **only if `.env` absent** (first-run only, idempotent). Pas de génération auto de secrets en 001b — l'opérateur édite après install.
- **A5 — Services activés** : tout le bundle (10 services par défaut). Pas de toggle vars en 001b — YAGNI, à exposer si demande utilisateur en 001b-bis.
- **A6 — Compose invocation** : `community.docker.docker_compose_v2` (state `present`).
- **A7 — Network** : `local-ai-packaged` crée ses networks internes. L'intégration avec `ai_net` ARC se fait en **001c (rôle sandbox)** — hors scope 001b.
- **A8 — Healthcheck post-up** : retry 30 × 10s sur Ollama (`curl http://localhost:11434/api/version`) + Supabase Studio (`curl http://localhost:54323`). 5 min de budget.

### Sous-tâche 3 — Validation finale (cadrage V1-V3, validés 2026-05-06)

- **V1** — `ansible-playbook --syntax-check setup.yml` → exit 0.
- **V2** — `ansible-lint setup.yml roles/` → 0 violation, profile `production` maintenu (escalade depuis 001a non régressée).
- **V3** — `pnpm test` → 144 verts maintenus (pas de TS modifié dans 001b, scope pure Ansible).

## Plan d'implémentation

### Sous-tâche 1 : Rôle `coolify`
- Fichiers : `playbooks/roles/coolify/{tasks,handlers,defaults}/main.yml` (création) + `playbooks/setup.yml` (append `coolify` dans `roles:`)
- Effort estimé : ~30 min
- Détail : `defaults` expose les 3 vars C6. `tasks` :
  1. `ansible.builtin.file` : ensure `/opt/coolify/` exists (mode 0755, owner root).
  2. `ansible.builtin.get_url` : download `docker-compose.yml` depuis `coolify_compose_url` → `{{ coolify_install_dir }}/docker-compose.yml`.
  3. `community.docker.docker_compose_v2` : `state: present`, `project_src: {{ coolify_install_dir }}`.
  4. Healthcheck combiné via `ansible.builtin.uri` (curl 8000) + `ansible.builtin.command: docker compose ps` avec `until: ... is succeeded` + `retries: 30 delay: 10`.
  Tags `[coolify, install]` / `[coolify, healthcheck]`. Pas de handler nécessaire si la conf compose ne change pas (idempotence via `community.docker.docker_compose_v2`).

### Sous-tâche 2 : Rôle `ai-stack` ✅
- Fichiers : `playbooks/roles/ai-stack/{tasks,handlers,defaults}/main.yml` + `templates/local-ai.env.j2` (NEW) + `playbooks/setup.yml` (append `ai-stack`)
- Détail livré : 11 tâches (3 secrets `become: false` + 8 install/healthcheck `become: true`). Template Jinja2 rendu first-run-only (stat-then-template), 16 secrets random + trio JWT démo upstream + 28 configs verbatim. Orchestration via `python3 start_services.py --profile cpu --environment private` (option β décidée — délègue à upstream pour le sparse-clone Supabase + sed SearXNG + double-compose). Symlink `/opt/local-ai/.env` → `~/.arc/credentials/local-ai.env` créé AVANT `start_services.py`. Kong remappé 8000→8001 pour éviter collision Coolify. Healthchecks Supabase Kong + Ollama (5 min retry). Debug task final affiche URLs + warning JWT regen.

### Sous-tâche 3 : Validation finale
- Fichiers : aucun changement code, scratchpad `current.md` enrichi avec résultats.
- Effort estimé : ~15 min
- Détail :
  - Run `ansible-playbook --syntax-check packages/arc-cli/playbooks/setup.yml` → exit 0 (V1).
  - Run `ansible-lint packages/arc-cli/playbooks/setup.yml packages/arc-cli/playbooks/roles/` → **0 violation, profile `production`** (V2). Si régression, fix avant clôture.
  - Run `pnpm test` → 144 verts (V3). Pas de TS modifié donc cache hit Turbo attendu.
  - Run `pnpm lint` et `pnpm typecheck` → verts (sanity globale).
  - Mettre à jour scratchpad avec résultats des commandes (sortie tail).
  - Pré-archive : statut → 🟢, recap commits, bilan validation finale (template repris d'ANSIBLE-001a).

## Notes pour ANSIBLE-001c (à lire au démarrage de 001c)
- 001b laisse `setup.yml` avec `roles: [hardening, docker, coolify, ai-stack]`. 001c ajoute `sandbox` (réseaux ADR-0008) et `backups` (cron + rclone) à la suite.
- `local-ai-packaged` tourne dans ses propres networks internes ; 001c bridge avec `ai_net` ARC.
- Coolify gère son network interne via son compose ; 001c ne le touche pas.
- `/opt/coolify/data` et `/opt/local-ai-packaged/` sont les sources des backups Postgres + volumes en 001c.

## Scratchpad
- _(empty — Claude met à jour pendant le travail : décisions, blockers, questions, commandes effectivement lancées et leurs sorties)_

## CLI gaps
- Si `requirements.yml` bumpe en `>=3.7,<4.0` plus tard (autre rôle aura besoin d'une feature 3.7+), remplacer `ansible.builtin.command: docker compose pull` par `community.docker.docker_compose_v2_pull` dans le rôle `coolify` pour cohérence idiomatique. Choisi en sous-tâche 1 d'001b pour rester sur `ansible.builtin.*` universel et éviter un bump dépendance pour 1 module.
- **JWT trio démo Supabase** : régénérer impérativement avant exposition publique (Caddy + DNS + Let's Encrypt). Lien doc : https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys. Trio actuel `JWT_SECRET / ANON_KEY / SERVICE_ROLE_KEY` = valeurs upstream démo, cryptographiquement liées (rotation atomique obligatoire).
- **Pinner le sparse-clone Supabase sur SHA** quand E2E-001 stable. `start_services.py` upstream fait `git pull master` sur `supabase/supabase` → drift potentiel à chaque run. Acceptable en 001b, à durcir.
- **SearXNG `cap_drop` dance** gérée par `start_services.py` upstream — risque de breaking change si upstream modifie. Surveiller à chaque bump du SHA pinned `arc_local_ai_version`.
- **Container name Ollama** dépend du profile (`ollama-cpu` / `ollama-gpu` / `ollama-gpu-amd`). Le pull task utilise `ollama-{{ arc_local_ai_profile }}` — vérifier mapping si bump du profile en var.
- **Suppression manuelle de `~/.arc/credentials/local-ai.env`** → regen secrets → desync avec données Postgres (anciens user/password DB locked out). Pattern « delete = nouvelle install ». Documenté dans le header du template + opérational warning.
