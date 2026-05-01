---
description: Finalise la tâche en cours (validation critères, archivage, mise à jour INDEX), prépare la tâche suivante
argument-hint: [--skip-checks]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Finaliser une tâche EuglowLabs ARC

Tu vas clôturer proprement la tâche actuelle et préparer la transition vers la suivante.

## Inputs

- `$1` optionnel : `--skip-checks` pour passer outre les vérifications (à n'utiliser que si l'utilisateur sait ce qu'il fait)

## Phase 0 — Pré-vérifications

1. Lis `CLAUDE.md`
2. Lis `tasks/current.md` → s'il est vide ou ne contient pas de tâche active : ARRÊTE et signale-le
3. Lis `tasks/INDEX.md`

## Phase 1 — Vérification des critères d'acceptation

Pour chaque case `- [ ]` dans la section "Critères d'acceptation" de `tasks/current.md` :

1. Lis le critère
2. Détermine la commande de vérification appropriée :
   - "tests verts" → `pnpm test` (ou `pnpm --filter <pkg> test`)
   - "lint passe" → `pnpm lint`
   - "build réussit" → `pnpm build`
   - "typecheck passe" → `pnpm typecheck`
   - "CI verte" → vérifier l'état de la dernière run GitHub Actions si possible (sinon demander)
   - Critère custom → demander confirmation à l'utilisateur

3. Lance la commande (sauf si `--skip-checks`)
4. Affiche le résultat

**Si une vérification échoue :**
- Affiche l'erreur
- Demande à l'utilisateur :
  - **(a)** Je corrige maintenant (tu attends)
  - **(b)** Tu corriges manuellement (j'arrête)
  - **(c)** Marquer le critère comme N/A avec justification (rare, à éviter)

NE PASSE PAS à la phase suivante tant que tous les critères ne sont pas validés (ou explicitement bypass).

## Phase 2 — Vérification de l'état du repo

1. `git status` → s'il y a des fichiers non committés liés à la tâche, signale-le
2. `git log -5 --oneline` → vérifie que les commits sont au format Conventional avec l'ID de tâche
3. Si la branche n'est pas mergée vers main et qu'on est en trunk-based : signale et propose la PR

**Format de commit attendu** (selon `docs/04-conventions/naming.md`) :
- `feat(scope): description [TASK-ID]`
- `fix(scope): description [TASK-ID]`
- `chore(scope): description [TASK-ID]`

Si des commits ne respectent pas le format : signale-les sans bloquer (juste un warning).

## Phase 3 — Mise à jour du scratchpad

Dans `tasks/current.md`, examine la section "Scratchpad" :
- Si elle contient des décisions techniques structurantes prises pendant l'implémentation : signale-les et propose à l'utilisateur de lancer `/arc-adr-new` pour les acter
- Si elle contient des questions ouvertes sans réponse : signale-les avant l'archivage
- Si elle contient des notes utiles pour le futur : assure-toi qu'elles sont préservées dans le fichier archivé

## Phase 4 — Archivage de la tâche

1. Génère le nom du fichier d'archive :
   - Format : `tasks/completed/{YYYY-MM-DD}-{TASK-ID}.md`
   - Exemple : `tasks/completed/2026-05-12-CLI-042.md`

2. Avant de déplacer, AJOUTE en haut du fichier `tasks/current.md` une section :

```markdown
## Statut final
✅ Terminée — YYYY-MM-DD HH:MM
Durée réelle : [estimer depuis la date de début]
PR : [URL si disponible, sinon "à faire"]

## Bilan
- Ce qui s'est bien passé : [...]
- Ce qui a posé problème : [...]
- Ce qu'on a appris : [...]
- Décisions prises (à acter en ADR si structurantes) : [...]
```

Demande à l'utilisateur de remplir le bilan en 30 secondes (ou propose un brouillon basé sur le scratchpad et les commits récents).

3. `mv tasks/current.md tasks/completed/{YYYY-MM-DD}-{TASK-ID}.md`

## Phase 5 — Mise à jour de l'INDEX

Dans `tasks/INDEX.md` :
- Change `🟡 [TASK-ID]` en `✅ [TASK-ID]`
- Si possible, ajoute la date de complétion à droite : `✅ TASK-ID — Titre (2026-05-12)`

## Phase 6 — Préparation de la tâche suivante

1. Identifie la prochaine tâche non commencée dans `tasks/INDEX.md`
2. Affiche-la à l'utilisateur :
   - ID + titre
   - Phase à laquelle elle appartient
   - Estimation rapide

3. Propose deux options :
   - **(a)** Démarrer cette tâche maintenant → l'utilisateur lancera `/arc-task-start [ID]`
   - **(b)** Pause / faire une autre tâche → tu ne fais rien

4. Crée un nouveau `tasks/current.md` minimal avec un placeholder :

```markdown
# Aucune tâche active

Pour démarrer une tâche, lance :

    /arc-task-start [TASK-ID]

Prochaine tâche suggérée : [TASK-ID-suivant]
```

## Phase 7 — Résumé final

Affiche à l'utilisateur :

```
✅ Tâche [TASK-ID] terminée

Critères validés : N/N
Fichiers archivés : tasks/completed/{date}-{id}.md
Index mis à jour : ✅ marqué dans tasks/INDEX.md

Statistiques de la phase {phase} :
- Terminées : X
- En cours : 0
- Restantes : Y

Prochaine tâche suggérée : [TASK-ID] — [titre]
Lance /arc-task-start [TASK-ID] quand tu veux la démarrer.
```

## Règles ABSOLUES

- Tu ne supprimes JAMAIS un fichier de tâche, tu archives toujours dans `completed/`
- Tu ne marques JAMAIS une tâche comme terminée sans valider les critères (sauf `--skip-checks` explicite)
- Tu ne crées PAS d'ADR depuis ce slash command — tu signales seulement, l'utilisateur décide
- Tu ne fais PAS `git commit` ni `git push` — l'utilisateur garde la main sur git
- Tu ne lances pas la tâche suivante automatiquement — l'utilisateur lance `/arc-task-start` lui-même