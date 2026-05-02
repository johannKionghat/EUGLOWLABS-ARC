# Tâche en cours : CLI-007 — Génération template `docker-compose.sandbox.yml` avec isolation

## Statut
🟡 En cours — démarrée le 2026-05-02

## Objectif
Frère symétrique de CLI-006. Ajouter le template eta de la **sandbox isolée** : `sandbox_net` avec `internal: true`, conteneur `code-executor` durci (`read_only`, `cap_drop: [ALL]`, `no-new-privileges`, mem/CPU limits), conteneur `code-server` pour debugging interactif. Implémente directement les contraintes d'**ADR-0008** (trois réseaux Docker isolés) et la spec infra §11.2 / §19. Réutilise le wrapper `renderTemplate()` de CLI-006.

## Critères d'acceptation
- [ ] Template eta `docker-compose.sandbox.yml.eta` versionné dans `__templates__/`
- [ ] Le compose généré déclare `sandbox_net` avec `driver: bridge` ET `internal: true` (critique — bloque internet)
- [ ] Service `code-executor` avec : `read_only: true`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, `mem_limit: 512m`, `cpus: 0.5`, `tmpfs: [/tmp:size=64m]`
- [ ] Service `code-server` avec un volume nommé pour le workspace persistant
- [ ] `.env.eta` étendu avec `CODE_SERVER_PASSWORD=__REPLACE_ME__`
- [ ] Fonction `generateSandboxCompose(cfg): string` exportée depuis `@euglowlabs/arc-cli/templates`
- [ ] ≥ 4 tests Vitest : présence de `internal: true`, des 5 contraintes de durcissement, des deux services, absence de placeholders eta non résolus
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` verts
- [ ] CI verte sur la PR
- [ ] PR mergée sur main

## Fichiers concernés (estimation)
- `packages/arc-cli/src/templates/__templates__/docker-compose.sandbox.yml.eta` (création)
- `packages/arc-cli/src/templates/__templates__/env.eta` (modif — ajout `CODE_SERVER_PASSWORD`)
- `packages/arc-cli/src/templates/sandbox-compose.ts` (création — `generateSandboxCompose`)
- `packages/arc-cli/src/templates/index.ts` (modif — export du nouveau générateur)
- `packages/arc-cli/src/templates/sandbox-compose.test.ts` (création — 4 tests)
- `packages/arc-cli/src/templates/env.test.ts` (modif — ajustement assertion CODE_SERVER_PASSWORD)

## ADRs liés
- ADR-0008 — **Trois réseaux Docker isolés** : implémentation directe du critère `sandbox_net: internal: true` + durcissement multi-couche
- ADR-0001 — Monorepo Turborepo
- ADR-0002 — Bun runtime CLI / clipanion

## Conventions à respecter
- `docs/04-conventions/coding-style.md` — TS strict, JSDoc, kebab-case fichiers
- `docs/04-conventions/testing.md` — Vitest collocated, cas limites couverts
- `docs/04-conventions/naming.md` — branche `feat/CLI-007-sandbox-template`, scope `cli`

## Hors scope (NE PAS faire)
- Pas de **agents compose** (CLI-008)
- Pas de **test d'isolation effective** (`docker exec sandbox-* ping internet doit échouer`) — ce test E2E demande un environnement Docker, reporté à AGENT-012
- Pas de **commande clipanion** (orchestration = CLI-012)
- Pas de **génération random du `CODE_SERVER_PASSWORD`** — placeholder explicite
- Pas d'**écriture sur disque** — fonction pure string
- Pas de **modification du `prod-compose.ts`**

## Plan d'implémentation

### Sous-tâche 1 : Template eta `docker-compose.sandbox.yml.eta`
- **Fichiers** : `src/templates/__templates__/docker-compose.sandbox.yml.eta`
- **Effort estimé** : 15 min
- **Détail** : Reprendre quasi-littéralement le squelette de spec-infra §19. Header de commentaire mentionnant le projet (`<%= it.cfg.project %>`) et un avertissement explicite "DO NOT remove `internal: true` — security boundary (ADR-0008)". Deux services : `code-executor` (node:20-alpine durci) et `code-server` (codercom/code-server avec password env). Volume `arc_sandbox_workspace`.

### Sous-tâche 2 : Étendre `env.eta` avec CODE_SERVER_PASSWORD
- **Fichiers** : `src/templates/__templates__/env.eta`, `src/templates/env.test.ts`
- **Effort estimé** : 5 min
- **Détail** : Ajouter une ligne `CODE_SERVER_PASSWORD=__REPLACE_ME__` après les autres placeholders. Mettre à jour l'assertion du test `env.test.ts` (existant) pour vérifier sa présence.

### Sous-tâche 3 : Générateur `generateSandboxCompose` + barrel
- **Fichiers** : `src/templates/sandbox-compose.ts`, `src/templates/index.ts`
- **Effort estimé** : 10 min
- **Détail** : Fonction `generateSandboxCompose(cfg: ArcConfig): string` qui appelle `renderTemplate("docker-compose.sandbox.yml.eta", { cfg })`. JSDoc renvoyant à ADR-0008 et spec-infra §11.2/§19. Ajouter l'export dans le barrel.

### Sous-tâche 4 : Tests Vitest
- **Fichiers** : `src/templates/sandbox-compose.test.ts`
- **Effort estimé** : 15 min
- **Détail** : 4 cas :
  1. Compose contient `internal: true` (assertion critique sécurité)
  2. Service `code-executor` contient les 5 contraintes de durcissement (`read_only: true`, `cap_drop`, `no-new-privileges:true`, `mem_limit: 512m`, `cpus: 0.5`)
  3. Service `code-server` présent avec image `codercom/code-server` et volume nommé
  4. Aucun placeholder eta non résolu (`<%[\s\S]*?%>`)

### Sous-tâche 5 : Vérif + commit + PR
- **Fichiers** : aucun nouveau
- **Effort estimé** : 10 min
- **Détail** : Inclure les artefacts pendants de CLI-006. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Vérifier que `dist/templates/__templates__/docker-compose.sandbox.yml.eta` est bien copié (postbuild). Branche `feat/CLI-007-sandbox-template`. Commit `feat(cli): generate hardened sandbox compose [CLI-007]`. Push, PR, attendre CI verte, merger.

## Scratchpad

### Décisions ouvertes — à valider avant de coder
- **Garder `code-server` dans le compose** : la spec-infra §19 inclut un IDE browser. C'est utile pour debug mais c'est aussi une surface d'attaque. Décision : on **garde**, l'utilisateur le commente s'il veut. Sécurité = mot de passe + accès uniquement via Traefik (pas exposé direct). À surveiller quand on documentera la prod.
- **Image `node:20-alpine`** pour `code-executor` : choix par défaut de la spec. Le runtime du code généré sera étendu plus tard (Python via image Python, etc.) — hors scope CLI-007.
- **Pas de label Traefik sur la sandbox** : volontaire, l'accès depuis l'internet public à la sandbox serait dangereux. Si IDE distant nécessaire, ce sera via tunnel Cloudflare ou bastion — autre tâche.

### Notes
- Le `internal: true` du réseau est la **garantie sécuritaire centrale** d'ADR-0008. À ne JAMAIS retirer ; le template porte le commentaire d'avertissement.
- `code-executor` reste passif (`tail -f /dev/null`) — DeepAgents (CLI-008) déclenchera l'exécution de code à la demande via `docker exec`.
- L'isolation effective (ping internet doit échouer) sera testée en CI E2E à AGENT-012.
