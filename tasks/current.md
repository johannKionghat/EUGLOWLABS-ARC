# Aucune tâche active

Pour démarrer une tâche, lance :

    /arc-task-start [TASK-ID]

## Prochaine tâche suggérée

**CLI-010** — `LocalAdapter` via execa (exec, copyFile, stream stdout)
*Phase 1 — CLI MVP*

Estimation : ~1h. Première implémentation concrète de `ExecutionAdapter` (CLI-009). Utilise `execa` pour exécuter des commandes shell sur la machine de l'opérateur (cwd, env, streaming par chunk via `stdout.on("data")`), `node:fs/promises` pour `copyFile`/`readFile`/`fileExists`. Sert dès `arc deploy --target=local` (CLI-012). Dépend de CLI-009 ✅.

CLI-011 (`VPSAdapter` via node-ssh + Hetzner) suit la même structure côté distant.

## Alternatives raisonnables

- **CLI-011** — `VPSAdapter` directement. On aurait les deux adapters complets avant `arc deploy`, mais Local est plus simple à valider — démarrer par Local est plus prudent.
- **AGENT-001** — Skeleton Go ARC Agent (Phase 2). Variation de stack après 9 PRs CLI consécutives.
- **INFRA-009** — README racine.
- **CLI-014** — State management `.infra/state.json`. Orthogonal, peut s'enchaîner sans dép.

## État du projet
- Phase 0 : 7/10
- Phase 1 : 9/28 (CLI-001 → 009 ✅)
- PRs mergées : 11
- Tests Vitest : 43 (arc-cli 35 + arc-shared 8)
