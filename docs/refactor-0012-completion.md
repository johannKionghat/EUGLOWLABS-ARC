# Refactor ADR-0012 — Completion report

> Phase D close-out. Snapshot pris à la fin du refactor single-machine, avant squash merge sur `main`.

## TL;DR

Le refactor 0012 est terminé. Le modèle dual `target: local | vps` a été entièrement éradiqué du code applicatif. La stack ARC tourne désormais en single-machine install (ADR-0012) : l'utilisateur SSH sur sa machine cible, `arc setup` exécute Ansible en local. Aucun résidu `VPSAdapter` / `provisionHetzner` / `arc migrate` / `cloudflared` dans le code. `pnpm test` est vert (78/78 tests).

## Métriques avant / après

| Métrique | Avant (commit `97d1765`) | Après (HEAD) | Δ |
|---|---|---|---|
| Fichiers TS dans `packages/arc-cli/src` | 64 | 56 | −8 |
| Fichiers TS dans `packages/arc-shared/src` | 7 | 6 | −1 |
| LoC supprimées (cumulé refactor) | — | ~700 | −700 |
| Dépendances directes `@euglowlabs/arc-cli` | 9 | 8 (`node-ssh` retiré) | −1 |
| Tests `arc-cli` | 78 | 71 | −7 (suppression VPS / migrate / tunnel) |
| Tests `arc-shared` | 7 | 7 | = |
| **Tests verts** | 100 % | **100 %** | OK |
| Commandes CLI exposées | 13 | 12 (`arc migrate` retiré, `arc setup` à venir) | −1 / +1 prévu |
| ADRs actifs Chantier 1 | 10 | 13 (+0011, +0012, +0013) | +3 |
| ADRs superseded | 0 | 1 (ADR-0009) | +1 |

## Fichiers refactorés (Phase D)

Un fichier = une ligne, dans l'ordre où ils ont été touchés :

- `packages/arc-cli/src/exec/local.ts` → renommé `host.ts`, classe `LocalAdapter` → `HostAdapter`, JSDoc `target=local|vps` → modèle single-machine
- `packages/arc-cli/src/exec/local.test.ts` → renommé `host.test.ts`, imports adaptés
- `packages/arc-cli/src/exec/index.ts` → barrel mis à jour (`export { HostAdapter }`)
- `packages/arc-cli/src/exec/types.ts` → JSDoc débarrassé des références `LocalAdapter` / `VPSAdapter` / dual target ; `ExecutionAdapter` reste l'extension point
- `packages/arc-cli/src/exec/mock.ts` → JSDoc nettoyé
- `packages/arc-cli/src/commands/{deploy,status,logs,restart,backup,restore,project,setup,init}.ts` → tous mis à jour pour utiliser `HostAdapter` (10 fichiers)
- `packages/arc-cli/src/deploy/deploy.ts` → suppression du gating `if cfg.target === "vps"`, JSDoc nettoyé
- `packages/arc-cli/src/deploy/deploy.test.ts` → tests recâblés sur le schéma post-refactor (3 tests verts)
- `packages/arc-cli/src/init/prompts.ts` → suppression `select(target)`, branche vps, champ tunnel
- `packages/arc-cli/src/init/serialize.ts` & `serialize.test.ts` → recâblage 2 tests
- `packages/arc-cli/src/init/write.test.ts` → recâblage 3 tests
- `packages/arc-cli/src/config/__fixtures__/valid-local.yml` → renommé `valid.yml`, `target` retiré
- `packages/arc-cli/src/config/__fixtures__/invalid-schema.yml` → cas `target: azure` retiré
- `packages/arc-cli/src/config/load.test.ts` → recâblage 4 tests
- `packages/arc-cli/src/templates/prod-compose.test.ts` → helper sans `target`
- `packages/arc-cli/src/templates/sandbox-compose.test.ts` → helper sans `target`
- `packages/arc-cli/src/templates/agents-compose.test.ts` → helper sans `target`
- `packages/arc-cli/src/templates/env.test.ts` → helper sans `target`
- `packages/arc-cli/src/ansible/run.ts` → JSDoc `target=local/vps` → ADR-0012 single-machine
- `packages/arc-shared/src/schemas/config.ts` → ajout bloc `agent: { bind, port }`, suppression `target` / `provider` / `superRefine target↔provider`
- `packages/arc-shared/src/schemas/config.test.ts` → 7 cas réécrits
- `packages/arc-shared/src/schemas/index.ts` → export `provider` supprimé
- `docs/00-overview.md` → réécrit pour single-machine + Chantier 1/2 split
- `docs/05-glossary.md` → entrées `target`, `LocalAdapter`/`VPSAdapter`, `Cloudflare Tunnel` mises à jour ou retirées
- `docs/03-architecture-decisions/0002-bun-runtime-cli.md` → stack actualisée (retrait `node-ssh`, `hetzner-cloud-js`)
- `docs/04-conventions/testing.md` → procédure E2E `arc deploy --target=vps` → `arc setup` sur la machine
- `CLAUDE.md` → 5 critères → 4, mention single-machine renforcée
- `README.md` → quickstart adapté (machine = VPS / RPi / WSL2…), tableau commandes (`arc setup` ajouté, `arc migrate` retiré)

## Audits grep (Phase D.3) — sortie brute

Cible : aucun résidu de l'ancien modèle dans le code applicatif. Les occurrences restantes en docs sont **historiques** (ADR-0009 superseded, refactor-0012-{inventory,progress}.md, tasks/completed/, .claude/commands/arc-bootstrap.md skill historique) et explicitement attendues.

### Audit 1 — `VPSAdapter` / `LocalAdapter`

```
docs/01-spec-infra.md:267:  ? new LocalAdapter()                      // execa direct, pas de SSH
docs/01-spec-infra.md:268:  : new VPSAdapter(config.provider);        // node-ssh + Hetzner API
docs/01-spec-infra.md:603:- [ ] Adapters `LocalAdapter` et `VPSAdapter`.
docs/refactor-0012-progress.md:20:- ✅ `8efa1d8` — `refactor(cli): remove VPSAdapter and Hetzner provisioning [REFACTOR-001]`…
docs/refactor-0012-inventory.md:* (multiples — fichier d'inventaire historique)
tasks/INDEX.md:42-44,70: lignes historiques de tâches (CLI-009, CLI-010, CLI-011, REFACTOR-002)
tasks/completed/2026-05-02-CLI-009.md, CLI-010.md, CLI-011.md (archives)
docs/03-architecture-decisions/0009-dual-target-local-vps.md:30-31 (ADR superseded)
docs/03-architecture-decisions/0012-single-machine-install.md:14,41,88 (ADR vivant qui documente la transition)
.claude/commands/arc-bootstrap.md:152 (skill bootstrap historique)
```

**Aucune occurrence dans `packages/`** ✅. Toutes les occurrences sont en docs (historique attendu) ou dans des ADRs qui documentent explicitement l'ancien modèle / la transition.

### Audit 2 — `target: vps` / `target.*vps` / `--target=vps`

```
docs/01-spec-infra.md:217,288,298,311,530,641 (spec v2.0 partiellement superseded — bandeau §6 ADR-0012)
docs/refactor-0012-{inventory,progress}.md (rapports historiques)
docs/03-architecture-decisions/0009-dual-target-local-vps.md (ADR superseded)
docs/03-architecture-decisions/0011-end-to-end-install-acceptance.md:23 (mention dans la table de mapping ancien→nouveau)
docs/03-architecture-decisions/0012-single-machine-install.md:10,52 (ADR vivant qui documente la transition)
.claude/commands/arc-bootstrap.md:55,152,221 (skill bootstrap historique)
tasks/completed/2026-05-02-CLI-{003,004,005}.md (archives historiques)
```

**Aucune occurrence dans `packages/`** ✅. Spec infra `01-spec-infra.md` reste avec son bandeau "partiellement superseded par ADR-0012" comme convenu en Phase B.

### Audit 3 — `node-ssh` / `hetzner-cloud-js`

```
docs/01-spec-infra.md:175,177,291,380,604 (spec v2.0 — bandeau §6 ADR-0012)
docs/02-spec-arc-product.md:646,648 (spec produit — bandeau ADR-0012)
docs/refactor-0012-{inventory,progress}.md (historique)
docs/03-architecture-decisions/0002-bun-runtime-cli.md:* — déjà nettoyé (mention résiduelle dans commits passés)
docs/03-architecture-decisions/0009-dual-target-local-vps.md:31 (ADR superseded)
docs/03-architecture-decisions/0012-single-machine-install.md:12,51 (transition documentée)
tasks/INDEX.md:44,69 (historique tâches)
tasks/completed/2026-05-02-CLI-011.md (archive)
```

**Aucune occurrence dans `packages/`** ✅. `pnpm list node-ssh` ne retourne rien : la dépendance est bien retirée du `package.json` de `arc-cli`.

### Audit 4 — `Cloudflare Tunnel` (hors ADRs et inventaire)

```
docs/01-spec-infra.md:292,293,298,539,575 (spec v2.0 — bandeau)
.claude/commands/arc-bootstrap.md:152 (skill historique)
docs/05-glossary.md:44 (Cloudflare Tunnel Agent↔Dashboard, Phase 2 — clairement scopé)
tasks/INDEX.md:57 (mention historique CLI-024 + tag "À supprimer en Phase 1.5")
tasks/completed/2026-05-02-CLI-024.md (archive)
```

**Aucune occurrence dans `packages/`** ✅. Glossaire restreint à la mention "Tunnel Agent↔Dashboard pour Phase 2", qui correspond à la mitigation P3 de ADR-0012.

## Tests — état final

```
pnpm test
✓ packages/arc-shared (7 tests)
✓ packages/arc-cli (71 tests)
Test Files  20 passed (20)
     Tests  78 passed (78)
```

Aucun `it.skip` n'a été ajouté pour contourner un test — chaque suite a été véritablement réécrite contre le schéma post-refactor.

## tasks/cancelled/ — vérification

Conformément à l'inventaire Phase A : les tâches CLI-029 → CLI-035 (Ansible roles, câblage Hetzner, `arc deploy --target=vps`, DNS auto, E2E VPS éphémère) **n'ont jamais été ajoutées à `tasks/INDEX.md` ni au backlog**. Elles n'existaient qu'à l'état de proposition dans une discussion. Aucun fichier `tasks/cancelled/` n'a donc été créé — il n'y a rien à annuler. La nouvelle Phase 1.5 (REFACTOR-001/002/003 + DOC-001 + INSTALL-001 + ANSIBLE-001 + DNS-001 + E2E-001) couvre tout le périmètre cible.

## Reste à faire avant merge

- [ ] `git add` + `git commit` les modifs Phase D restantes (CLAUDE.md, README.md, overview, glossary, ADR-0002, testing.md, ansible/run.ts, ce rapport)
- [ ] `git push origin refactor/adr-0012-single-machine`
- [ ] **Attendre `"go merge"` explicite de l'utilisateur** avant squash merge sur `main` (consigne D.7)

## Liens

- [ADR-0012 — Single-machine install model](03-architecture-decisions/0012-single-machine-install.md)
- [ADR-0011 — End-to-end install acceptance (25 critères)](03-architecture-decisions/0011-end-to-end-install-acceptance.md)
- [ADR-0013 — Chantier 1/2 separation](03-architecture-decisions/0013-chantier-1-2-separation.md)
- [ADR-0009 — Dual target (superseded)](03-architecture-decisions/0009-dual-target-local-vps.md)
- [Inventory Phase A](refactor-0012-inventory.md)
- [Progress log Phase B/C/D](refactor-0012-progress.md)
