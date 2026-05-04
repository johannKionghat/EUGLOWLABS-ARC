# Tâche en cours : INSTALL-001a — `arc setup` cœur orchestration

## Statut
🟡 En cours — démarrée le 2026-05-04 (plan en attente de validation utilisateur)

## Objectif
Livrer le **squelette de `arc setup`** : commande Clipanion enregistrée, idempotence sur `~/.arc/arc.config.yml` existant, prompts interactifs (réutilisés depuis `arc init`), écriture validée zod du fichier de config dans `~/.arc/`. Pas d'invocation Ansible ni de génération de composes (= INSTALL-001b). Cette tâche débloque la suite (Agent + Dashboard + VALIDATE-*) en posant le point d'entrée du parcours d'install.

## Critères d'acceptation
- [ ] Commande `arc setup` enregistrée dans `cli.ts`, exposée dans `arc help` avec usage et exemples.
- [ ] Détection idempotente d'une config existante à `~/.arc/arc.config.yml` :
  - Si absente → flux normal : prompts → write.
  - Si présente et valide → menu `@clack/prompts.select` proposant : (a) garder telle quelle (exit 0), (b) réécrire (avec confirmation), (c) annuler (exit 0).
  - Si présente mais corrompue → message d'erreur clair, refus de réécrire sans `--force` explicite.
- [ ] Helper `paths.ts` créé (cf. ADR-0015) exposant au minimum `arcUserDir()` et `arcConfigPath()`. Aucun chemin `~/.arc/...` en dur ailleurs dans le code touché par cette tâche.
- [ ] `~/.arc/` créé avec mode `0755` si absent. `~/.arc/arc.config.yml` écrit avec mode `0644`.
- [ ] Tests Vitest verts :
  - `paths.test.ts` : helper retourne le bon chemin selon `process.env.HOME`.
  - `idempotence.test.ts` : 4 cas (absente, présente valide, présente corrompue, mode `--force`).
  - `orchestrate.test.ts` : E2E mock — prompts scriptés → fichier écrit → exit 0.
- [ ] `pnpm test` + `pnpm lint` + `pnpm typecheck` verts.
- [ ] Aucun `any` non justifié, aucun `console.log` résiduel, fonctions < 40 lignes.

## Fichiers concernés (estimation)
- `packages/arc-cli/src/commands/setup.ts` (création)
- `packages/arc-cli/src/setup/index.ts` (création — barrel)
- `packages/arc-cli/src/setup/idempotence.ts` (création)
- `packages/arc-cli/src/setup/idempotence.test.ts` (création)
- `packages/arc-cli/src/setup/orchestrate.ts` (création — version 001a, étendue par 001b)
- `packages/arc-cli/src/setup/orchestrate.test.ts` (création)
- `packages/arc-cli/src/paths.ts` (création — cf. ADR-0015)
- `packages/arc-cli/src/paths.test.ts` (création)
- `packages/arc-cli/src/cli.ts` (modification — register `SetupCommand`)
- `packages/arc-cli/src/init/write.ts` (modif possible — tolérer cible hors `cwd`)

Total estimé : 10 fichiers touchés (création + 1 modif). Sous le seuil "5 fichiers → STOP" parce que la majorité sont nouveaux et conceptuellement liés (pattern command + orchestrator + tests cohérents). Si tu juges ce nombre excessif, signale-le maintenant.

## ADRs liés
- **ADR-0001** — Monorepo Turborepo + pnpm.
- **ADR-0002** — Bun + clipanion + zod + `@clack/prompts` + execa + eta.
- **ADR-0011** — Critère **A4** (idempotence : un second `arc setup` ne casse pas).
- **ADR-0012** — Single-machine (pas de SSH outbound).
- **ADR-0015** — Layout artefacts `~/.arc/` (créé en début de tâche). `paths.ts` doit refléter cet ADR.

## Conventions à respecter
- `docs/04-conventions/coding-style.md` — TS strict, fonctions < 40 lignes, pas de `console.log`.
- `docs/04-conventions/testing.md` — Vitest, MockAdapter pour exec, fs `tmp/` ou memfs.
- `docs/04-conventions/git-workflow.md` — Conventional Commits, `[INSTALL-001a]` dans le message.

## Hors scope (NE PAS faire)
- **Invocation Ansible** = INSTALL-001b.
- **Génération composes maison** = INSTALL-001b.
- **Détection `ansible-playbook` sur PATH** = INSTALL-001b.
- **Création des records DNS Cloudflare** = DNS-001.
- **Auto-installation Ansible** si absent (jamais — message d'erreur balisé suffit en 001b).
- **Refactor de `arc init`** — `arc setup` réutilise `promptForConfig()` mais reste une commande distincte.
- **Création de `~/.arc/credentials/`** — sera fait par AGENT-003 (token statique Phase 2).
- **Helper `arcComposeDir()` / `arcCredentialsDir()`** — INSTALL-001b si encore non créé là.

## Plan d'implémentation (révisé — 4 sous-tâches, ≤ 1h30 total)

### Sous-tâche 1 : Helper `paths.ts` + tests (≤ 20 min)
- Fichiers : `packages/arc-cli/src/paths.ts`, `paths.test.ts`.
- Détail : exporter `arcUserDir(): string` (résout `~/.arc` via `os.homedir()` ou `process.env.HOME` selon convention), `arcConfigPath(): string` (= `arcUserDir() + "/arc.config.yml"`). Tests : variation de `HOME`, idempotence du chemin retourné. Référence ADR-0015 dans le JSDoc.

### Sous-tâche 2 : Détection idempotence config existante (≤ 25 min)
- Fichiers : `setup/idempotence.ts`, `idempotence.test.ts`.
- Détail : fonction `detectExistingConfig(): Promise<{exists: boolean, path: string, valid: boolean, contents?: ArcConfig}>`. Lit `arcConfigPath()`, parse YAML, valide via zod schema existant. Retourne l'état. Tests via fs mock : config absente, présente valide, présente corrompue (YAML invalide), présente avec champs manquants (zod fail).

### Sous-tâche 3 : Orchestrateur + commande Clipanion (≤ 30 min)
- Fichiers : `setup/orchestrate.ts`, `commands/setup.ts`, `cli.ts` (register).
- Détail : fonction `runSetup(opts: {force?: boolean})` qui appelle `detectExistingConfig()`, branche selon le résultat (write direct / menu select / abort), réutilise `promptForConfig()` et `writeArcConfig()` existants en visant `arcConfigPath()`. Mode `--force` court-circuite la confirmation et écrase. `SetupCommand` Clipanion l'invoque. Création de `~/.arc/` (mkdir -p mode 0755) avant write.

### Sous-tâche 4 : Tests E2E orchestrateur + lint/typecheck/test verts (≤ 25 min)
- Fichiers : `setup/orchestrate.test.ts` (extension), peut-être `commands/setup.test.ts` léger.
- Détail : tests bout-en-bout en mode mock — réponses prompts simulées via stdin scripté, fs `tmp/` réel, vérifier `~/.arc/arc.config.yml` produit avec contenu attendu, vérifier exit code 0. Cas idempotence : (a) garder, (b) réécrire avec confirmation, (c) annuler. Vérifier `pnpm test`, `pnpm lint`, `pnpm typecheck` verts en local.

## Scratchpad

### Justification 1 ligne par fichier (validation user — 10 fichiers cohérents, pas de scope creep)
- `paths.ts` — helpers purs sur `~/.arc/*` (testable isolé, source de vérité ADR-0015).
- `paths.test.ts` — tests unitaires du helper (variation `HOME`, idempotence du chemin).
- `setup/idempotence.ts` — détection 4 états de la config existante (responsabilité claire, abord testable).
- `setup/idempotence.test.ts` — tests unitaires des 4 cas (absente, valide, corrompue, zod fail).
- `setup/orchestrate.ts` — `runSetup()` qui branche idempotence → prompts → write (orchestration pure).
- `setup/orchestrate.test.ts` — tests unitaires des 3 branches d'orchestration.
- `setup/index.ts` — barrel d'exports (cohérent avec `init/index.ts` existant, pas de logique).
- `commands/setup.ts` — `SetupCommand` Clipanion : binding CLI pur, délègue à `runSetup()`.
- `cli.ts` (modif) — register `SetupCommand` dans la CLI factory existante.
- `init/write.ts` (modif possible) — tolérer cible hors `cwd` si pas déjà supporté (à confirmer en lecture).

**Garde-fou** : si en cours de route un fichier perd sa raison d'être (responsabilité floue, pourrait être inline ailleurs), STOP et redemander avant de le créer.
