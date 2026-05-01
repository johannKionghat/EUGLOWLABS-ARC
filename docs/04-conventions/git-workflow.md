# Git Workflow — EuglowLabs ARC

## Modèle : Trunk-based development

- Branche par défaut : `main`
- **Pas de branche `develop`**, pas de Git Flow
- Toutes les branches sont **courtes** (durée de vie < 48h)
- Une branche = une tâche

## Règles fondamentales

- **1 PR = 1 tâche `[SCOPE]-NNN` = max 2h de travail**
- Pas de scope creep dans une PR : si une refacto émerge, créer une tâche dédiée
- **Pas de modification de 2 packages** dans la même PR (frontière de package = frontière de PR)
- Pas de commit direct sur `main`
- Pas de **force-push sur `main`** ni sur les branches partagées
- Les hooks (`pre-commit`, `commit-msg`) ne sont **jamais skippés** (`--no-verify` interdit sauf incident exceptionnel documenté)

## Création d'une branche

```bash
# Toujours partir de main à jour
git switch main && git pull --ff-only

# Créer la branche
git switch -c feat/CLI-042-add-deploy-command
```

## Commits

- Format : Conventional Commits **avec `[TASK-ID]` final** (cf. `naming.md`)
- Un commit = une intention logique cohérente
- Sous-tâches d'une tâche = plusieurs commits, regroupés par squash au merge
- Tests verts en local avant chaque push

## Pull Request

- Titre = sujet du commit principal (`feat(cli): add deploy command [CLI-042]`)
- Description : contexte court + lien vers la tâche dans `tasks/completed/CLI-042-*.md`
- Checklist auto-revue (cf. `pr-review.md`) **avant** de demander review
- **Squash merge** systématique (historique `main` propre, 1 tâche = 1 commit sur main)

## Checks obligatoires avant merge

- [ ] CI verte (lint Biome + types TS + tests Vitest + tests Go)
- [ ] Auto-revue PR checklist remplie
- [ ] Aucun secret loggé / committé
- [ ] Documentation à jour si API publique modifiée
- [ ] ADR mis à jour ou créé si décision structurante touchée

## Après merge

- Suppression automatique de la branche distante (config GitHub)
- Déplacement de la tâche `tasks/current.md` → `tasks/completed/<TASK-ID>-*.md`
- Mise à jour de `tasks/INDEX.md` (✅)
- Choix de la tâche suivante depuis l'INDEX ou le backlog

## Rebases

- Rebase de **sa propre branche** sur `main` à jour avant ouverture de PR : OK
- Rebase de branche **déjà partagée** : interdit (force-push casserait les revues en cours)
- Pas de `git rebase -i` interactif sur des commits poussés
