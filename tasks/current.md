# Tâche en cours : INFRA-007 — Hook `commit-msg` via lefthook

## Statut
🟡 En cours — démarrée le 2026-05-02

## Objectif
Installer lefthook et configurer un hook `commit-msg` qui rejette tout message de commit ne respectant pas le format Conventional Commits **avec ID de tâche** (cf. `docs/04-conventions/naming.md`). Empêche en local les commits non conformes avant qu'ils ne polluent l'historique.

## Critères d'acceptation
- [ ] `lefthook` est installé en devDependency racine
- [ ] `lefthook.yml` versionné définit un hook `commit-msg`
- [ ] Le hook rejette `chore: do stuff` (pas de scope, pas de TASK-ID) avec un message d'erreur lisible
- [ ] Le hook rejette `feat(cli): add deploy command` (pas de TASK-ID)
- [ ] Le hook accepte `feat(cli): add deploy command [CLI-042]`
- [ ] Le hook accepte les merge commits / revert / le format de squash GitHub `... [TASK-ID] (#NN)`
- [ ] Script `prepare` installe les hooks automatiquement après `pnpm install`
- [ ] CI reste verte (le hook ne tourne pas en CI mais l'install ne casse rien)
- [ ] PR mergée sur main

## Fichiers concernés (estimation)
- `package.json` (modification : devDep `lefthook`, script `prepare`)
- `lefthook.yml` (création)
- `scripts/validate-commit-msg.mjs` (création — petit script Node de validation regex avec messages d'erreur clairs)
- `docs/04-conventions/git-workflow.md` (modification : section "Hooks locaux" avec mention lefthook)

## ADRs liés
Aucun ADR à créer — outillage local pur, pas de décision structurante.

## Conventions à respecter
- `docs/04-conventions/naming.md` — section "Commits" : format `<type>(<scope>): <description> [<TASK-ID>]`
- `docs/04-conventions/git-workflow.md` — règle "hooks jamais skippés" (`--no-verify` interdit sauf incident)
- `docs/04-conventions/coding-style.md` — script Node : `import` ordonnés, pas de `any`

## Hors scope (NE PAS faire)
- Pas de hook `pre-commit` (lint-staged, format) — autre tâche si besoin (à inscrire au backlog)
- Pas de hook `pre-push` (run tests) — risque de friction, à débattre dans une tâche dédiée
- Pas d'intégration commitlint (lefthook + petit script Node suffit, évite une dépendance lourde)
- Pas de modification du workflow CI (les hooks sont locaux uniquement, par design)

## Plan d'implémentation

### Sous-tâche 1 : Choix outillage + ajout dépendance
- **Fichiers** : `package.json`
- **Effort estimé** : 5 min
- **Détail** : Ajouter `lefthook` en `devDependencies`. Ajouter un script `prepare` racine qui exécute `lefthook install` (déclenché automatiquement par `pnpm install`). Choix : pas de commitlint (évite une deuxième couche de tooling) ; on valide avec un petit script Node maison qui produit des messages d'erreur clairs.

### Sous-tâche 2 : Script de validation Node
- **Fichiers** : `scripts/validate-commit-msg.mjs`
- **Effort estimé** : 20 min
- **Détail** : Lit le fichier passé en argument (`$1` = `.git/COMMIT_EDITMSG`), récupère la première ligne non vide. Bypass pour `Merge ...`, `Revert ...`, `fixup!`, `squash!`. Sinon valide via regex `^(feat|fix|refactor|chore|docs|test|spike)(\([a-z0-9-]+\))?: .+ \[[A-Z]+-\d+\]( \(#\d+\))?$`. En cas d'échec, affiche un message d'erreur explicite avec exemple correct + types autorisés + lien vers `docs/04-conventions/naming.md`. Exit code 1 sur erreur.

### Sous-tâche 3 : Configuration lefthook.yml
- **Fichiers** : `lefthook.yml`
- **Effort estimé** : 10 min
- **Détail** : Hook `commit-msg` qui invoque `node scripts/validate-commit-msg.mjs {1}`. Pas d'autre hook configuré dans cette tâche. Configurer `skip_output: meta` pour réduire le bruit.

### Sous-tâche 4 : Tests manuels du hook
- **Effort estimé** : 15 min
- **Détail** : Faire 5 essais de commit (sans les pousser) pour valider :
  1. ❌ `git commit -m "wip"` → rejeté
  2. ❌ `git commit -m "feat: do thing"` → rejeté (pas de TASK-ID)
  3. ❌ `git commit -m "feat(cli): add x"` → rejeté
  4. ✅ `git commit -m "feat(cli): add x [CLI-001]"` → accepté
  5. ✅ Merge commit / Revert / squash GitHub style → accepté
  Annuler chaque commit accepté avec `git reset --soft HEAD~1`.

### Sous-tâche 5 : Documentation conventions
- **Fichiers** : `docs/04-conventions/git-workflow.md`
- **Effort estimé** : 10 min
- **Détail** : Ajouter section "Hooks locaux" expliquant l'installation auto via `pnpm install`, la liste des hooks actifs (`commit-msg`), comment bypass exceptionnel (`LEFTHOOK=0` ou `--no-verify` interdit par convention sauf incident documenté).

### Sous-tâche 6 : Vérification + commit + PR
- **Effort estimé** : 15 min
- **Détail** : `pnpm install` (vérifie que `prepare` installe lefthook). Tester un commit valide pour confirmer. Branche `feat/INFRA-007-lefthook-commit-msg`. Commit `chore(repo): add lefthook commit-msg hook [INFRA-007]`. Push + PR + merge.

## Scratchpad

### Décisions ouvertes — à valider avant de coder
- **lefthook vs husky** : lefthook choisi (binaire Go natif, plus rapide, config YAML déclarative, parallèle). Husky est plus connu mais tout en JS et plus lent.
- **Validation par script Node maison vs commitlint** : script Node maison choisi (zero-dep, messages d'erreur sur-mesure, pas de fichier de config supplémentaire). commitlint serait surdimensionné pour un seul format.
- **Format regex strict** : on n'autorise PAS de message multi-lignes spéciaux ; le body du commit reste libre, seule la première ligne est validée.

### Notes
- Le script Node tourne avec le Node système (≥20 acté dans `.tool-versions`). Pas besoin de Bun ici — le hook doit fonctionner même si Bun n'est pas installé.
- Lefthook s'installe via npm/pnpm, pas besoin de binaire séparé.
