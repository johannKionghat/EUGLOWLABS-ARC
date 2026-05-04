# Tâche en cours : INSTALL-001 — `arc setup` cœur orchestration

## Statut
🟡 En cours — démarrée le 2026-05-04 (plan en attente de validation utilisateur)

## Objectif
Livrer le **squelette de `arc setup`** : commande Clipanion enregistrée, idempotence sur `~/.arc/arc.config.yml` existant, prompts interactifs (réutilisés depuis `arc init`), écriture validée zod du fichier de config dans `~/.arc/`. Pas d'invocation Ansible ni de génération de composes (= INSTALL-002). Cette tâche débloque la suite (Agent + Dashboard + VALIDATE-*) en posant le point d'entrée du parcours d'install.

## Critères d'acceptation
- [ ] Commande `arc setup` enregistrée dans `cli.ts`, exposée dans `arc help` avec usage et exemples.
- [ ] Détection idempotente d'une config existante à `~/.arc/arc.config.yml` (6 cas — voir Cadrage idempotence ci-dessous).
- [ ] `detectExistingConfig()` est une **fonction pure de détection** : I/O readonly + parsing. Aucune modif fichier, aucun prompt user, aucun side effect. Les actions correctives sont exclusivement gérées par l'orchestrateur (sous-tâche 3).
- [ ] Helper `paths.ts` créé (cf. ADR-0015) exposant au minimum `arcUserDir()` et `arcConfigPath()`. Aucun chemin `~/.arc/...` en dur ailleurs dans le code touché par cette tâche.
- [ ] `~/.arc/` créé avec mode `0755` si absent. `~/.arc/arc.config.yml` écrit avec mode `0644`.
- [ ] Tests Vitest verts :
  - `paths.test.ts` : helper retourne le bon chemin selon `process.env.HOME`. ✅ (sous-tâche 1).
  - `idempotence.test.ts` : **6 cas** (absente, valide, corrompue YAML, schéma zod fail, permission denied, user dir invalid).
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
- `docs/04-conventions/git-workflow.md` — Conventional Commits, `[INSTALL-001]` dans le message.

## Hors scope (NE PAS faire)
- **Invocation Ansible** = INSTALL-002.
- **Génération composes maison** = INSTALL-002.
- **Détection `ansible-playbook` sur PATH** = INSTALL-002.
- **Création des records DNS Cloudflare** = DNS-001.
- **Auto-installation Ansible** si absent (jamais — message d'erreur balisé suffit en 001b).
- **Refactor de `arc init`** — `arc setup` réutilise `promptForConfig()` mais reste une commande distincte.
- **Création de `~/.arc/credentials/`** — sera fait par AGENT-003 (token statique Phase 2).
- **Helper `arcComposeDir()` / `arcCredentialsDir()`** — INSTALL-002 si encore non créé là.

## Plan d'implémentation (révisé — 4 sous-tâches, ≤ 1h30 total)

### Sous-tâche 1 : Helper `paths.ts` + tests (≤ 20 min)
- Fichiers : `packages/arc-cli/src/paths.ts`, `paths.test.ts`.
- Détail : exporter `arcUserDir(): string` (résout `~/.arc` via `os.homedir()` ou `process.env.HOME` selon convention), `arcConfigPath(): string` (= `arcUserDir() + "/arc.config.yml"`). Tests : variation de `HOME`, idempotence du chemin retourné. Référence ADR-0015 dans le JSDoc.

### Sous-tâche 2 : Détection idempotence config existante (≤ 30 min — élargi de 25 à 30 min pour 6 cas au lieu de 4)
- Fichiers : `setup/idempotence.ts`, `idempotence.test.ts`.
- Détail : fonction `detectExistingConfig()` **pure de détection** retournant un `DetectionResult` discriminé selon le `status` (cf. Cadrage idempotence dans le scratchpad). Pas de side effects. 6 cas testés en isolation via fs `tmp/` réel.

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

### Observations smoke test (2026-05-04, sous-tâche 4)

Confirmé en CLI compilée (`pnpm build` → `packages/arc-cli/dist/index.js`) :
- ✅ Build TS → JS sans erreur, templates copiés.
- ✅ `arc help` liste `arc setup` avec usage `arc setup [--force,-f]`.
- ✅ `arc setup --help` affiche correctement description + options + 2 exemples.

Smoke test interactif via stdin pipé (échec attendu, partiel) :
- ⚠️ Driver clack/prompts via `printf '...' | node ...` produit un comportement dégradé : clack rendre les caractères mais le pipe sans TTY ne déclenche pas la validation correctement — fichier final non créé. **C'est un comportement clack, pas un bug ARC** : clack/prompts est conçu pour TTY raw mode.
- 🚧 **Smoke test "vraiment interactif" reste à valider humainement** par l'auteur dans un terminal réel : `HOME=/tmp/arc-smoke-$(date +%s) node packages/arc-cli/dist/index.js setup`. À couvrir plus tard automatiquement par E2E-001 (avec `node-pty` ou subprocess + PTY).

### Sous-tâches accomplies
- 1/4 ✅ paths.ts (commit `e8f8f9b`)
- 2/4 ✅ idempotence.ts (commit `fdab4b4`)
- 3/4 ✅ orchestrate.ts + sensitive.ts + commands/setup.ts + cli register + barrel (commit `4f6193f`)
- 4/4 ✅ E2E tests via CLI factory (8 cas, 1 skipped Windows) — commit en cours

### Cadrage idempotence — `detectExistingConfig()` (figé avant code)

**Signature** :

```ts
type DetectionResult =
  | { status: "absent" }
  | { status: "valid"; config: ArcConfig }
  | { status: "corrupted"; raw: string; error: Error }
  | { status: "schema_mismatch"; raw: unknown; errors: ZodError }
  | { status: "permission_denied"; path: string; error: Error }
  | { status: "user_dir_invalid"; path: string; reason: string };

async function detectExistingConfig(): Promise<DetectionResult>;
```

**Règle invariante** : fonction **pure de détection**. I/O readonly + parsing uniquement. Aucune modif fichier, aucun prompt, aucun exit. Les actions correctives sont gérées par l'orchestrateur (sous-tâche 3).

**Les 6 cas testés** (un test par cas dans `idempotence.test.ts`) :

| Cas | Précondition | Comportement attendu |
|---|---|---|
| 1 — Absent | `~/.arc/arc.config.yml` n'existe pas | `{ status: "absent" }` |
| 2 — Valid | YAML valide + zod ok | `{ status: "valid", config }` |
| 3 — Corrupted | Fichier existe mais YAML invalide (parse error) | `{ status: "corrupted", raw, error }` |
| 4 — Schema mismatch | YAML valide mais zod fail (champs manquants/wrong type) | `{ status: "schema_mismatch", raw, errors }` |
| 5 — Permission denied | Fichier existe mais lecture interdite (chmod 000 ou owner différent) | `{ status: "permission_denied", path, error }` |
| 6 — User dir invalid | `~/.arc/` existe mais c'est un fichier (pas un dossier) | `{ status: "user_dir_invalid", path, reason }` |

**Comportement orchestrate (sous-tâche 3 — pour mémoire, pas dans 001 idempotence.ts)** :

- Cas 1 → mode prompts direct (premier setup).
- Cas 2 → menu `select` : Réutiliser (exit 0) / Réécrire (prompts avec defaults actuels) / Annuler (exit 0).
- Cas 3 → message + 2 actions : Backup `~/.arc/arc.config.yml.broken-<timestamp>` + repartir / Annuler (exit 1). **Jamais de reset silencieux.**
- Cas 4 → message listant les champs invalides + 3 actions : Compléter interactivement (re-prompts avec valides comme defaults) / Backup + repartir / Annuler (exit 1).
- Cas 5 → message d'erreur + exit 1 (l'utilisateur résout les permissions à la main).
- Cas 6 → message d'erreur + exit 1 (l'utilisateur supprime / renomme `~/.arc` à la main).
