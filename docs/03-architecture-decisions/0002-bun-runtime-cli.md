# ADR-0002 : Bun comme runtime du CLI `arc`

## Statut
Accepté
Date : 2026-05-01

## Contexte
Le CLI `arc` est le point d'entrée du produit. Il doit :
- Démarrer rapidement (UX `arc status` < 200ms perçu)
- Se distribuer en **single binary** sur Linux / macOS / Windows (curl install, Homebrew, npm)
- Manipuler des SDKs JS/TS (Cloudflare DNS notamment)
- Valider des configs avec zod
- Templater des fichiers (eta)
- Streamer stdout/stderr d'Ansible exécuté localement (single-machine — ADR-0012)

La spec infra v2.0 §5.3 mentionne explicitement Bun ou Node, et la spec produit §11.1 acte Bun.

## Décision
Le CLI `arc` est exécuté en **Bun 1.x**, distribué en single binary natif via `bun build --compile --target=bun-linux-x64` (et équivalents macOS / Windows).

Stack figée pour le CLI :
- Runtime : Bun
- Framework CLI : `clipanion`
- Prompts : `@clack/prompts`
- Validation : `zod`
- Templating : `eta`
- Exécution locale : `execa`
- Cloudflare DNS : SDK officiel (Phase 1.5+)

## Conséquences
+ Single binary distribué sans dépendance Node installée chez l'utilisateur
+ Démarrage < 50ms vs 200-400ms en Node
+ TS natif sans transpile step
+ Tests via `bun test` (compatible Vitest API à 90%) — on garde Vitest pour cohérence avec Dashboard / Cloud
- Quelques SDKs npm peuvent avoir des bugs de compat Bun → mitigation : tester chaque SDK ajouté
- Compilation cross-target Windows demande GitHub Actions matrix

## Alternatives rejetées
- **Node + `pkg`** — `pkg` n'est plus maintenu activement (archivé par Vercel) ; alternative `@yao-pkg/pkg` existe mais marginal
- **Deno** — meilleur runtime à plusieurs égards, mais compatibilité npm encore inférieure à Bun en 2026
- **Node + `nexe` ou `boxednode`** — moins propre que `bun build --compile`, build plus lent
