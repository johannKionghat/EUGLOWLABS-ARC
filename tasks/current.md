# Tâche en cours : INSTALL-002 — `arc setup` exécution stack

## Statut
🟡 En cours — démarrée le 2026-05-04

## Objectif
Compléter `arc setup` (cœur livré par INSTALL-001) avec la phase **apply** : détecter `ansible-playbook` sur PATH, invoquer un playbook stub no-op (le vrai playbook est ANSIBLE-001), et générer les composes maison sous `~/.arc/compose/`. Cible : un `arc setup --apply` exécutable de bout en bout, testable via MockAdapter, qui livre un cadre d'invocation prêt à recevoir les rôles Ansible réels.

## Critères d'acceptation
- [ ] Helper `arcComposeDir()` + `arcCredentialsDir()` + `bundledPlaybookPath()` ajoutés dans `paths.ts`
- [ ] Stub `playbooks/setup.yml` créé (play `localhost`, message balisé conforme au backlog, exit 0), localisé pour résolution depuis le binaire compilé
- [ ] Fonction `assertAnsibleInstalled(adapter)` : `ansible-playbook --version` → message d'erreur balisé clair si absent, **pas d'auto-install**
- [ ] Fonction `applyStack(cfg, adapter)` : `mkdir -p ~/.arc/compose/` (mode 0755) → écrit les 3 composes via `generateProdCompose`/`generateSandboxCompose`/`generateAgentsCompose` → invoque le stub via `runAnsiblePlaybook`
- [ ] Flag `--apply` ajouté à `SetupCommand` ; sans `--apply`, comportement INSTALL-001 inchangé
- [ ] Quand `--apply` est passé : `runSetup` appelle `applyStack` après écriture/réutilisation de la config (et dans le chemin "reuse")
- [ ] Tests E2E Vitest : config existante + `--apply` → composes générés sur fs tmp + adapter mock reçoit `ansible-playbook ... playbooks/setup.yml` + exit 0
- [ ] Test : `--apply` sans `ansible-playbook` sur PATH → exit code env_error + message balisé
- [ ] `Command.Usage` de `setup.ts` mentionne `--apply` avec un exemple
- [ ] Ligne `arc setup` du tableau commandes du README racine ajoutée/mise à jour
- [ ] `pnpm test` + `pnpm lint` + `pnpm typecheck` verts (objectif ≥ 109 tests verts)

## Fichiers concernés (estimation : 6-7 fichiers)
- `packages/arc-cli/src/paths.ts` (extension)
- `packages/arc-cli/src/setup/apply.ts` (création)
- `packages/arc-cli/src/setup/apply.test.ts` (création)
- `packages/arc-cli/src/setup/orchestrate.ts` (branchement `--apply`)
- `packages/arc-cli/src/commands/setup.ts` (flag + usage)
- `packages/arc-cli/playbooks/setup.yml` (création stub — sous le package pour bundling)
- `README.md` racine (ligne tableau commandes)

⚠️ 7 fichiers, à la limite haute. Si extension `orchestrate.ts` devient lourde, on garde tout dans `apply.ts` et on n'expose qu'un point d'entrée unique.

## ADRs liés
- ADR-0011 — Critère **A3** (`arc setup` < 15 min). Ce stub ne valide PAS A3 ; A3 viendra avec ANSIBLE-001 + E2E-001
- ADR-0012 — Single-machine, `ansible-playbook` invoqué en `localhost`
- ADR-0015 — Layout `~/.arc/compose/` (helpers obligatoires, pas de chemin en dur)

## Conventions à respecter
- `coding-style.md` — TS strict, zéro `any` non justifié
- `testing.md` — Vitest, MockAdapter pour Ansible, fs réel sur `tmp/` ou env `HOME` override
- ADR-0015 — toute référence à `~/.arc/...` passe par les helpers de `paths.ts`

## Hors scope (NE PAS faire)
- Écrire les vrais rôles Ansible (= ANSIBLE-001)
- Auto-installer `ansible-playbook` si absent
- Créer les records DNS Cloudflare (= DNS-001)
- Lancer un E2E sur VM jetable (= E2E-001)
- Toucher à `arc init` (gel décidé en INSTALL-001)
- Refactorer la résolution des chemins de templates eta (déjà OK)

## Questions ouvertes à arbitrer avant de coder
1. **Localisation du stub `playbooks/setup.yml`** : repo root (comme indiqué dans le backlog `tasks/backlog/INSTALL-002.md` ligne 27) **OU** sous `packages/arc-cli/playbooks/` pour être bundlé avec le binaire `bun build --compile` ? Recommandation : **sous le package** (`packages/arc-cli/playbooks/setup.yml`) pour que `bundledPlaybookPath()` fonctionne aussi en single binary. Le repo root rendrait le stub introuvable une fois le CLI installé via npm/Homebrew.
2. **Comportement par défaut de `arc setup`** : avec `--apply` uniquement (cohérent avec l'actuel hint `arc setup --apply`), ou apply automatique post-config-write ? Recommandation : **`--apply` opt-in**, conserve la séparation prompt/apply lisible et ne casse pas les tests INSTALL-001.

## Plan d'implémentation

### Sous-tâche 1 : Extension `paths.ts` + tests
- Fichiers : `paths.ts`, `paths.test.ts` (création)
- Effort : ~15 min
- Détail : ajoute `arcComposeDir()`, `arcCredentialsDir()`, `bundledPlaybookPath()`. Le dernier résout depuis `import.meta.url` vers `<package>/playbooks/setup.yml`. Tests : valeurs sous `$HOME` override, présence du fichier playbook bundlé.

### Sous-tâche 2 : Stub `playbooks/setup.yml`
- Fichiers : `packages/arc-cli/playbooks/setup.yml` (création)
- Effort : ~10 min
- Détail : play `hosts: localhost`, `connection: local`, une `debug` task imprimant le message balisé exact du backlog, exit 0 implicite. Vérifier que le bundling Bun inclut bien le fichier (sinon l'ajouter à `package.json#files`).

### Sous-tâche 3 : `assertAnsibleInstalled` + helper run
- Fichiers : `setup/apply.ts` (création initiale), `setup/apply.test.ts` (création)
- Effort : ~25 min
- Détail : fonction qui exec `ansible-playbook --version` via adapter, capture exit ≠ 0 ou ENOENT, lance erreur balisée `ANSIBLE_NOT_FOUND` avec instructions d'install (apt/brew/pip). Tests via MockAdapter : success, exit code ≠ 0, exception throw.

### Sous-tâche 4 : `applyStack(cfg, adapter)`
- Fichiers : `setup/apply.ts` (extension), `setup/apply.test.ts` (extension)
- Effort : ~25 min
- Détail : mkdir -p `arcComposeDir()` mode 0755, écrit les 3 composes via les générateurs existants, appelle `runAnsiblePlaybook(adapter, bundledPlaybookPath(), { onLine })`. Retourne `EXIT_OK` ou `EXIT_ENV_ERROR`. Tests : fs réel sous `HOME` override, MockAdapter assert call args.

### Sous-tâche 5 : Branchement `--apply` dans orchestrate + commande
- Fichiers : `setup/orchestrate.ts`, `commands/setup.ts`
- Effort : ~20 min
- Détail : ajoute `applyStack` dans `SetupOptions`, propage flag `apply: boolean`. Quand `apply === true` ET le statut final est OK (`absent` après write, `valid` après reuse, `corrupted/schema_mismatch` après backup+rewrite), appelle `applyStack(cfg, hostAdapter)`. Met à jour `Command.Usage` avec un exemple `arc setup --apply`.

### Sous-tâche 6 : Tests E2E setup-e2e.test.ts
- Fichiers : `setup/setup-e2e.test.ts` (extension)
- Effort : ~25 min
- Détail : 3 nouveaux scénarios — (a) `--apply` sans config existante : prompts mock + apply OK ; (b) `--apply` avec config valide réutilisée : apply direct ; (c) `--apply` sans `ansible-playbook` : exit env_error + message balisé. Mock `HostAdapter` injectable via factory déjà en place.

### Sous-tâche 7 : Doc — Usage + README
- Fichiers : `commands/setup.ts` (Usage déjà touché en sous-tâche 5, vérification finale), `README.md`
- Effort : ~10 min
- Détail : ligne tableau commandes README mise à jour pour mentionner `arc setup [--apply]` avec une description courte (config + génération composes + apply Ansible stub).

## Scratchpad
- **Sous-tâche 1 ✅** (commit `13dcfe4`) : `paths.ts` étendu avec 4 helpers (`arcComposeDir`, `arcCredentialsDir`, `arcStatePath`, `bundledPlaybookPath`). Bonne nouvelle : `bundledPlaybookPath()` résout pareil depuis src/ et dist/ (les deux sont 1 niveau sous le package root) → `../playbooks/setup.yml`. Pas besoin de copy step. Tests : 13 passés + 1 skip (existence playbook, à délivrer en sous-tâche 2). Suite globale arc-cli : 115 passés + 3 skipped.
- **Sous-tâche 2 ✅** : stub `packages/arc-cli/playbooks/setup.yml` créé (1 play `localhost`/`connection: local`, 1 task `debug` avec les 4 lignes de message exactes). YAML validé via `yaml.parse` Node (pas d'Ansible local — voir CLI gap ci-dessous). `playbooks` ajouté à `package.json#files`. Test d'existence unskippé. Suite globale arc-cli : **116 passés + 2 skipped**. Lint + typecheck verts.

- **Sous-tâche 3 ✅** : `setup/apply.ts` créé avec `assertAnsibleInstalled(adapter)`, classes d'erreur typées (`AnsibleNotInstalledError`, `AnsibleExecutionError`), constante exportée `ANSIBLE_NOT_INSTALLED_MESSAGE` (message littéral conforme au cadrage). Parser de version gère les 2 formats (`[core X.Y.Z]` moderne et `ansible-playbook X.Y.Z` legacy). Détection binaire absent : exit 127 OU rejet ENOENT. **Choix arbitraire MVP : version min 2.14** — à valider/ajuster en E2E-001 selon distros testées. 8 tests apply.test.ts (5 cas demandés + 2 cas dégénérés stdout vide/unparseable + 1 contrat littéral du message). Suite globale arc-cli : **124 passés + 2 skipped**. Lint + typecheck verts.
- **Sous-tâche 4 ✅** (la dense) : `applyStack(cfg, adapter, opts)` livré avec ordre transactionnel strict (1.detect → 2.scan → 3.prompt → 4.mkdir → 5.tmp/render → 6.ansible → 7.rename atomique → 8.commit state.json). `setup/state.ts` créé avec schéma zod (schema_version literal 1, last_apply ISO datetime, compose_files string[], ansible_version, playbook_run_id uuid v4). `setup/exit-codes.ts` extrait pour casser la circularité orchestrate↔apply. **Décisions appliquées** : (D1.a) noms réels `docker-compose.{agents,prod,sandbox}.yml` triés alpha ; (D2) ordre exact, .tmp/ wipé sur échec, state.json = commit marker uniquement après succès Ansible ; (D3) prompt avec Annuler en 1er choix (default safe), wording différencié "déjà appliquée" vs "détectés" ; (D4) `--force` skip prompt + log `FORCE_NOTICE`, **bloque toujours** sur Ansible absent ou génération qui throw ; (D5) zod schema, future_schema détecté avec warning ; (D6) chmod 0o700 dir + 0o600 files appliqué via re-chmod (umask defense) ; (D7) 9 tests applyStack (8 demandés + bonus permissions ADR-0015). Tests permission denied (#6) et permissions ADR-0015 sont `it.skipIf(win32)`. **Ordre 6/7 inversé en sous-tâche 4** (correction post-livraison sur revue user, commit fix dédié) : rename `.tmp/`→final déplacé AVANT Ansible pour permettre au playbook de lire les composes via `docker compose -f ~/.arc/compose/X.yml`. Nouveau contrat : state.json est le seul commit marker, les composes peuvent rester en place après échec Ansible (inspection + retry possibles). Test #8 mis à jour : composes EN PLACE après Ansible KO. Suite globale arc-cli : **131 passés + 4 skipped** (vs 124+2). Lint + typecheck verts.
- **Sous-tâche 5 ✅** : `--apply` branché. `commands/setup.ts` ajoute `Option.Boolean("--apply", false)` et propage. `runSetup` accepte `apply?: boolean` ; helper `finalizeSuccess(opts)` mutualise la fin de chaque chemin succès (handleAbsent + reuse + reprompt convergent dessus). Sans `--apply` → noteApplyHint INSTALL-001 inchangé (D4). Avec `--apply` → re-detect post-write pour récupérer un `ArcConfig` validé, appel `applyStack(cfg, HostAdapter, { force })`, lecture `state.json` post-succès pour récupérer `playbook_run_id`, affichage `APPLY_SUCCESS_TEMPLATE` littéral (D3). `--force` sans `--apply` → `FORCE_WITHOUT_APPLY_NOTICE` affiché en début de runSetup (D2). Tests orchestrate.test.ts : 9 existants verts (non-régression) + **6 nouveaux** (apply+absent, apply+valid+reuse, apply+valid+cancel, apply+force, force-without-apply notice, contrat littéral APPLY_SUCCESS_TEMPLATE). vi.mock sur `./apply.js` et `./state.js` ajoutés (pattern existant `./idempotence.js`). Suite globale arc-cli : **137 passés + 4 skipped** (vs 131+4). Lint + typecheck verts.
- **Sous-tâche 6 ✅** : 3 nouveaux scénarios E2E dans `setup-e2e.test.ts` via la CLI factory `runFromArgs`. Mock HostAdapter via `vi.hoisted` + `vi.mock("../exec/index.js")` — `FakeHostAdapter` programmable per-test (programAnsibleOk / programAnsibleAbsent). E2E-9 (apply + absent) : config + composes + state.json créés, run_id substitué dans APPLY_SUCCESS_TEMPLATE. E2E-10 (apply + valid + Réutiliser) : config byte-identique, composes + state OK. E2E-11 (apply sans Ansible) : exit 2, message littéral `ANSIBLE_NOT_INSTALLED_MESSAGE` capturé via cancel mock, config écrite mais compose/state ABSENTS, pas de stack trace dans stderr (contrat persona-B). Captures `cancelCalls`/`noteCalls` ajoutées au mock @clack/prompts (cohérent avec apply.test.ts). Suite globale arc-cli : **140 passés + 4 skipped** (vs 137+4). Lint + typecheck verts.
- **Smoke test manuel ✅** (utilisateur, post sous-tâche 6) : `pnpm build` OK ; `arc setup --apply` sans Ansible → ANSIBLE_NOT_INSTALLED_MESSAGE affiché tel quel + exit 2 + zéro stack trace ; config créée pré-Ansible ; compose/state.json absents (transaction abortée correctement).
- **Sous-tâche 7 ✅** : `Command.Usage` déjà mise à jour en sous-tâche 5 (4 exemples : sans flag, --apply, --apply --force, --force). README racine ligne tableau mise à jour : `arc setup [--apply] [--force]  # Configure ~/.arc/arc.config.yml; with --apply, generate composes + run Ansible`. Lint + typecheck + tests verts (140 + 4 skipped).

## CLI gaps (notes parking)
- **CLI-025 — bundling `bun build --compile`** : `bundledPlaybookPath()` résout vers `<package>/playbooks/setup.yml`, OK pour npm install / Homebrew. Pour le binaire single `bun build --compile`, vérifier que le playbook (et les futurs rôles ANSIBLE-001 sous `playbooks/roles/`) sont bien embarqués comme assets. Si non, ajouter un flag `--asset` au script `build:bin` ou extraire le playbook au runtime. À traiter avant E2E-001 sur VM jetable.

## Notes pour ANSIBLE-001
- Contrat transactionnel posé en INSTALL-002 sous-tâche 4 (après correction d'ordre) :
  - `applyStack` rename `.tmp/`→final AVANT d'invoquer Ansible. Les rôles ANSIBLE-001 lisent les composes à leur emplacement final (`~/.arc/compose/docker-compose.X.yml`).
  - `state.json` = commit marker. ANSIBLE-001 ne doit PAS écrire dans state.json (c'est `applyStack` qui le fait sur retour 0 du playbook).
  - Si playbook échoue : composes restent en place pour inspection user. Idempotence prompt sur run suivant détectera le "reset partiel" via le wording "Composes existants détectés" (test #5).
