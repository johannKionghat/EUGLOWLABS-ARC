# Refactor ADR-0012 — Progress log

> Mis à jour à chaque étape Phase C / Phase D.

## Phase A — Inventaire ✅
- 2026-05-03 : `docs/refactor-0012-inventory.md` produit.

## Phase B — ADRs + planification ✅
- 2026-05-03 : Architect review (GO + 5 prérequis intégrés)
- 2026-05-03 : ADR-0011 / ADR-0012 / ADR-0013 créés. ADR-0009 superseded.
- 2026-05-03 : INDEX restructuré (Chantier 1/2 séparés). CHANTIER-1-VALIDATION.md créé.
- 2026-05-03 : Commit Phase B `[REFACTOR-000]` sur branche `refactor/adr-0012-single-machine`.

## Phase C — Suppression chirurgicale ✅
> Règle d'or : on supprime AVANT de refactorer.

### Commits Phase C

- ✅ `0c25e7e` — `refactor(cli): remove arc migrate command and orchestrator [REFACTOR-001]` (commands/migrate.ts, migrate/migrate.{ts,test.ts}, register dans cli.ts)
- ✅ `8efa1d8` — `refactor(cli): remove VPSAdapter and Hetzner provisioning [REFACTOR-001]` (vps.{ts,test.ts}, provision.ts, exec/index.ts exports, `pnpm remove node-ssh`)
- ✅ `1c97f56` — `refactor(cli): remove cloudflared tunnel CLI helper [REFACTOR-001]` (tunnel/cloudflared.{ts,test.ts})
- ✅ `caf10fe` — `refactor(shared): drop target/provider/tunnel from config schema [REFACTOR-001]` (provider.ts, schemas/index, config.ts +`agent: { bind, port }`, dns.ts -`tunnel`, prompts.ts simplifié, deploy.ts gating retiré)
- ✅ `cc21aec` — `refactor(cli): remove valid-vps fixture [REFACTOR-001]`
- ✅ `a0e16f3` — `chore: biome format package.json after node-ssh removal [REFACTOR-001]`

### Stade requis fin Phase C

- ✅ `pnpm typecheck` passe (5 tasks success)
- ✅ `pnpm build` passe (4 tasks success)
- ✅ `pnpm lint` passe (92 fichiers, 0 erreur)
- ⚠️ `pnpm test` casse intentionnellement (5+ tests `arc-shared/config.test.ts`, plus `arc-cli/config/load.test.ts`, `arc-cli/templates/prod-compose.test.ts`, `arc-cli/init/serialize.test.ts` qui référencent target/provider/tunnel ou fixture valid-vps.yml). **Phase D les corrigera.**

## Phase D — Refactor + audit zéro résidu (à venir)

### Métriques Phase C

| Métrique | Cible Phase A | Réel fin Phase C |
|---|---|---|
| Fichiers source supprimés | 10 | **10** (vps.ts/test, provision.ts, migrate/{ts,test,command}, cloudflared.ts/test, valid-vps.yml, provider.ts) |
| LoC éliminées | ~700 | ~715 (estimation `git diff main...HEAD --stat`) |
| Tests Vitest supprimés | 5 | **5** (vps.test ×2, migrate.test ×1, cloudflared.test ×2) |
| Dépendances retirées | 1 | **1** (`node-ssh`) |
| Modifs minimales pour typecheck | n/a | 4 fichiers (cli.ts, exec/index.ts, schemas/index.ts, config.ts, dns.ts, prompts.ts, deploy.ts) |
