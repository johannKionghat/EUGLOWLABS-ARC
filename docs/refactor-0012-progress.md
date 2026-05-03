# Refactor ADR-0012 — Progress log

> Mis à jour à chaque étape Phase C / Phase D.

## Phase A — Inventaire ✅
- 2026-05-03 : `docs/refactor-0012-inventory.md` produit.

## Phase B — ADRs + planification ✅
- 2026-05-03 : Architect review (GO + 5 prérequis intégrés)
- 2026-05-03 : ADR-0011 / ADR-0012 / ADR-0013 créés. ADR-0009 superseded.
- 2026-05-03 : INDEX restructuré (Chantier 1/2 séparés). CHANTIER-1-VALIDATION.md créé.
- 2026-05-03 : Commit Phase B `[REFACTOR-000]` sur branche `refactor/adr-0012-single-machine`.

## Phase C — Suppression chirurgicale 🟡
> Règle d'or : on supprime AVANT de refactorer.

### C.2 — Commits prévus (suppressions atomiques)

- [ ] **C.2.1** — Suppression `arc migrate` (commande + orchestrateur + tests + import dans cli.ts)
- [ ] **C.2.2** — Suppression `VPSAdapter` + `provisionHetzner` (vps.ts/test, provision.ts, exports cassés dans exec/index.ts)
- [ ] **C.2.3** — Suppression `cloudflared` CLI helper (tunnel/cloudflared.ts/test)
- [ ] **C.2.4** — Suppression `providerSchema` + champs `target`/`provider` du config schéma + `tunnel` du dns schéma
- [ ] **C.2.5** — Suppression fixture `valid-vps.yml`
- [ ] **C.2.6** — `pnpm remove node-ssh`

### C.3 — Stade requis fin Phase C
- [ ] `pnpm typecheck` passe
- [ ] `pnpm build` passe
- [ ] Tests cassés acceptés (Phase D les corrigera)

## Phase D — Refactor + audit zéro résidu (à venir)

## Métriques

| Métrique | Cible | Actuel |
|---|---|---|
| Fichiers source supprimés | 10 | 0 |
| Fichiers refactorés | ~16 | 0 |
| LoC éliminées | ~700 | 0 |
| Tests Vitest supprimés | 5 | 0 |
| Dépendances retirées | 1 (`node-ssh`) | 0 |
