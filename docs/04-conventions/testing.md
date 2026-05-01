# Testing — EuglowLabs ARC

## Frameworks

| Stack | Outil | Cible |
|---|---|---|
| TypeScript unit + integration | **Vitest** | CLI, Dashboard, Cloud, shared |
| End-to-end UI | **Playwright** | ARC Dashboard, ARC Cloud |
| Go unit + integration | `go test` standard + **testify** | ARC Agent |
| API contract (REST) | Vitest + `supertest` ou `undici` | ARC Cloud, ARC Agent |
| Smoke tests deploy | scripts shell exécutés sur VPS de staging | release readiness |

## Obligation

- **Tout nouveau code de logique métier a au moins un test**
- **Toute correction de bug a un test de non-régression** qui reproduit le bug avant le fix
- Les tests existants ne sont jamais supprimés sans justification documentée
- Pas de test `.skip()` committé sans ticket de dette technique référencé en commentaire

## Ce qui ne nécessite PAS de test

- Fichiers de configuration (`turbo.json`, `tsconfig.json`)
- Pages Next.js purement d'affichage (les tests E2E couvrent le critique)
- Wrappers triviaux d'1 ligne autour d'un SDK officiel

## Couverture

- Cible : **≥ 70% sur le code modifié** dans la PR (mesuré par `vitest --coverage`)
- Cas limites obligatoires : `null`, `undefined`, valeur vide, valeur aux bornes, erreur attendue
- La couverture n'est pas un objectif en soi : un test qui ne teste rien ne compte pas

## Organisation

```
package/src/
├── feature.ts
└── feature.test.ts          # collocated, suffix .test.ts
```

Tests E2E Dashboard et Cloud : `apps/<app>/e2e/*.spec.ts`.

## Exécution

```bash
# Tout le monorepo
pnpm test              # Vitest sur tous les packages TS
pnpm test:e2e          # Playwright (Dashboard + Cloud)
pnpm -F arc-agent test # délègue à go test via Makefile

# Watch mode
pnpm test --watch

# Coverage
pnpm test --coverage
```

## Tests d'intégration ARC Agent

Tests E2E sur **VPS de staging** déclenchés en CI avant merge sur `main` pour les changements touchant l'Agent ou le déploiement :

1. Provision d'un VPS éphémère via API Hetzner
2. `arc deploy --target=vps` complet
3. Suite Playwright contre le Dashboard live
4. Vérification de l'isolation sandbox (test : ping internet depuis sandbox_net doit échouer — cf. ADR-0008)
5. Téardown du VPS

Coût : ~0,02 € par run (CX22 facturé à l'heure).

## Tests flaky

- Un test flaky est un **bug** — jamais de retry-til-pass sans investigation
- Marquer `.skip()` avec un ticket de tâche `[SCOPE]-NNN` est temporairement acceptable, mais le ticket doit être ouvert immédiatement
