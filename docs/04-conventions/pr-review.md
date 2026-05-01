# PR Review — EuglowLabs ARC

## Auto-revue OBLIGATOIRE avant ouverture de PR

Cette checklist est cochée par l'auteur **avant** de demander une review.
Si une case ne peut être cochée → la PR n'est pas prête.

### Code & qualité
- [ ] La PR adresse **une seule tâche** `[SCOPE]-NNN` (pas de scope creep)
- [ ] La PR ne touche qu'**un seul package** du monorepo
- [ ] Lint Biome passe en local (`pnpm lint`)
- [ ] Types TS passent en local (`pnpm typecheck`)
- [ ] (Go) `gofmt` + `golangci-lint run` passent
- [ ] Aucun `console.log` / `fmt.Println` de debug oublié
- [ ] Aucun `// TODO` sans ID de tâche associée
- [ ] Aucun `any` non justifié par commentaire `arc-allow-any:`
- [ ] Aucun fichier > 500 lignes sans justification
- [ ] Aucune fonction > 50 lignes sans justification

### Tests
- [ ] Tests écrits pour le nouveau code (cf. `testing.md`)
- [ ] Si bug fix : test de non-régression inclus
- [ ] Tous les tests existants passent (`pnpm test`)
- [ ] Cas limites couverts (null / vide / erreur)
- [ ] Coverage ≥ 70% sur le code modifié

### Sécurité
- [ ] Aucun secret en dur
- [ ] Aucun nouveau path d'injection (SQL, shell, eval)
- [ ] Validation des entrées externes via zod (TS) ou équivalent (Go)
- [ ] Si modification de l'auth ou de l'isolation réseau → ADR mis à jour

### Documentation
- [ ] README package mis à jour si API publique modifiée
- [ ] JSDoc / godoc à jour sur les fonctions exportées
- [ ] **ADR créé ou mis à jour** si décision structurante touchée
- [ ] Glossaire `docs/05-glossary.md` à jour si nouveau terme introduit
- [ ] CHANGELOG.md (Changesets) si publication npm prévue

### Tâche
- [ ] `tasks/current.md` reflète l'état réel
- [ ] Critères d'acceptation de la tâche tous cochés
- [ ] Tâche prête à être déplacée vers `tasks/completed/` au merge

### UX (PR Dashboard ou Cloud uniquement)
- [ ] Testé à 375px (mobile) — aucun overflow
- [ ] Testé à 768px (tablette) et 1280px (desktop)
- [ ] Touch targets ≥ 44px sur mobile
- [ ] États loading + empty + error implémentés

## Format du commentaire d'ouverture de PR

```markdown
## Tâche
[CLI-042] Add deploy command

## Contexte
<2-3 phrases : pourquoi ce changement, ADRs concernés>

## Changements
- bullet 1
- bullet 2

## Tests
<comment ça a été testé : tests unitaires, E2E, manuel sur staging>

## Checklist
✅ Auto-revue PR remplie (cf. docs/04-conventions/pr-review.md)
```

## Reviewer (humain ou agent)

Quand un reviewer accepte de relire :
1. Vérifier que la checklist d'auto-revue est cochée
2. Lire le diff dans l'ordre du flow logique, pas dans l'ordre des fichiers
3. Tester en local si la PR touche un parcours utilisateur
4. Approuver, ou demander des changements **avec justification**

## Squash merge

Le squash merge est **systématique** sur `main`. Le titre du commit squashé doit suivre le format Conventional Commits avec ID tâche (cf. `naming.md`).
