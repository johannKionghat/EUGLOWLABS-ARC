# Tâche en cours : CLI-002 — Commande `arc help` + branding ASCII

## Statut
🟡 En cours — démarrée le 2026-05-02

## Objectif
Donner au CLI son identité visuelle dès l'aide racine. Ajouter une commande `arc help` (cohérence avec le pattern `arc <verbe>`) qui affiche un header ASCII "EuglowLabs ARC" suivi de l'aide générée par clipanion. Le branding s'applique aussi à `arc -h` / `arc --help` (mêmes points d'entrée), mais **pas** à l'aide d'une sous-commande (`arc version --help`).

## Critères d'acceptation
- [ ] `arc help` affiche le banner ASCII puis la liste des commandes
- [ ] `arc -h` et `arc --help` affichent le même banner + aide
- [ ] `arc version --help` (aide d'une sous-commande) n'affiche **pas** le banner
- [ ] Le banner est purement ASCII (pas d'unicode large, pas d'emoji) — lisible dans tous les terminaux
- [ ] Les tests Vitest existants passent + 2 nouveaux cas (`arc help` + non-banner sur sous-commande)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` verts
- [ ] CI verte sur la PR
- [ ] PR mergée sur main

## Fichiers concernés (estimation)
- `packages/arc-cli/src/banner.ts` (création — constante `BANNER` + helper `renderBanner(stdout)`)
- `packages/arc-cli/src/commands/help.ts` (création — `HelpCommand` clipanion remplaçant `Builtins.HelpCommand`)
- `packages/arc-cli/src/cli.ts` (modif — remplacer `Builtins.HelpCommand` par `HelpCommand`)
- `packages/arc-cli/src/cli.test.ts` (modif — ajouter assertions banner)

## ADRs liés
- ADR-0001 — Monorepo Turborepo
- ADR-0002 — Bun runtime CLI / clipanion

## Conventions à respecter
- `docs/04-conventions/coding-style.md` — TS strict, JSDoc sur exports, kebab-case fichiers
- `docs/04-conventions/testing.md` — Vitest collocated, cas limites couverts
- `docs/04-conventions/naming.md` — branche `feat/CLI-002-help-banner`, scope `cli`

## Hors scope (NE PAS faire)
- Pas de couleurs ANSI dans le banner (laisser clipanion gérer ses propres couleurs ; le banner doit rester lisible sans terminal coloré)
- Pas de version dynamique embarquée dans le banner — la version est déjà affichée par le header clipanion auto
- Pas d'autres commandes ajoutées
- Pas de modification de `VersionCommand`
- Pas de prompt interactif

## Plan d'implémentation

### Sous-tâche 1 : Banner ASCII
- **Fichiers** : `packages/arc-cli/src/banner.ts`
- **Effort estimé** : 10 min
- **Détail** : Créer une constante `BANNER` (string multi-ligne) avec un logo ASCII "EuglowLabs ARC" + tagline "Autonomous Resource Cloud" + ligne vide finale. Privilégier un style sobre lisible à 80 colonnes (pas de figlet géant). Exporter aussi un helper `renderBanner(stdout: Writable)` qui écrit `BANNER + "\n"`.

### Sous-tâche 2 : HelpCommand clipanion
- **Fichiers** : `packages/arc-cli/src/commands/help.ts`
- **Effort estimé** : 15 min
- **Détail** : Définir `class HelpCommand extends Command` avec `paths = [["help"], ["-h"], ["--help"]]`. Méthode `execute()` : (1) écrit le banner via `renderBanner(this.context.stdout)`, (2) écrit la sortie de `this.cli.usage(null)`, (3) retourne 0. JSDoc explicite que cette commande remplace volontairement `Builtins.HelpCommand` pour injecter le branding.

### Sous-tâche 3 : Wiring dans cli.ts
- **Fichiers** : `packages/arc-cli/src/cli.ts`
- **Effort estimé** : 5 min
- **Détail** : Retirer `cli.register(Builtins.HelpCommand)`. Ajouter `cli.register(HelpCommand)`. Conserver `Builtins.VersionCommand` (continue de gérer `--version` sans banner). L'ordre d'enregistrement est sans importance côté clipanion.

### Sous-tâche 4 : Tests
- **Fichiers** : `packages/arc-cli/src/cli.test.ts`
- **Effort estimé** : 15 min
- **Détail** : Ajouter 2 nouveaux cas et ajuster ceux existants si besoin :
  - `runFromArgs(["help"])` → exit 0, stdout contient `EuglowLabs ARC` (texte du banner) ET `arc version` (commande listée)
  - `runFromArgs(["--help"])` → exit 0, stdout contient `EuglowLabs ARC` (banner partagé)
  - `runFromArgs(["version", "--help"])` → exit 0, stdout NE contient PAS la ligne du banner ASCII (vérifié via une marque caractéristique du banner)
  - Le test "no args" existant reste valide (clipanion affiche son aide par défaut, qui passe par notre HelpCommand → contient le banner)

### Sous-tâche 5 : Vérif + commit + PR
- **Fichiers** : aucun nouveau
- **Effort estimé** : 10 min
- **Détail** : `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Smoke test du binaire compilé : `node packages/arc-cli/dist/index.js help` doit afficher le banner. Branche `feat/CLI-002-help-banner`. Commit `feat(cli): add help command with ASCII banner [CLI-002]`. Inclure les artefacts pendants de CLI-001 (tasks/INDEX, tasks/current, archive). Push, PR, attendre CI verte, merger.

## Scratchpad

### Décisions ouvertes
- **Style du banner** : ASCII sobre 5-6 lignes max, pas de figlet géant. À ajuster visuellement après affichage local. Si l'esthétique est très importante, prévoir une option `--no-banner` plus tard (hors scope CLI-002).
- **Surcharge des Builtins** : on remplace `Builtins.HelpCommand` par notre `HelpCommand` qui couvre les mêmes paths (`-h`, `--help`, `help`). Si clipanion ajoute des cas non couverts (ex: comportement spécial sur certains argv), on adaptera. À surveiller en CLI-005+.

### Notes
- Le banner ne doit PAS contenir de caractères qui plantent un terminal Windows cmd legacy (pas d'unicode > U+007F). Valider avec un caractère seulement de base ASCII (`#`, `=`, `/`, `\`, `_`).
- L'aide d'une sous-commande (`arc version --help`) est gérée en interne par clipanion sans passer par notre HelpCommand → pas de banner, conforme au critère.
