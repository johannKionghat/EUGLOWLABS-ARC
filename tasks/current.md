# Tâche en cours : DIST-001 — Distribution & packaging ARC

## Statut

🟡 En cours — démarrée le 2026-05-08

## Objectif

Substituer `git clone` par `curl install-arc.euglowlabs.com | sh` comme méthode officielle de distribution d'ARC. Boucler le pipeline release (binaire Bun standalone + playbooks embed + CI sur tag + hosting + docs) qui était latent depuis Phase 1 (CLI-025/026/027 marquées ✅ mais jamais bouclées en pratique). Critère final : un VPS Ubuntu 24.04 vierge doit pouvoir installer et lancer ARC sans aucun `git`, ni accès au repo source.

## Critères d'acceptation

- [ ] ADR-0016 distribution strategy livré, statut Accepté, listé dans `docs/03-architecture-decisions/README.md`
- [ ] `curl -fsSL https://install-arc.euglowlabs.com | sh` télécharge `arc` v0.1.0 et le pose dans `/usr/local/bin/`
- [ ] `arc version` retourne `0.1.0 (sha=<short>, built=<ISO date>)`
- [ ] `arc setup --apply` fonctionne sur VM Ubuntu 24.04 vierge **sans `git clone`** (playbooks embed)
- [ ] `arc upgrade` imprime le message d'usage `curl ... | sh`
- [ ] `git push --tags v0.1.0` déclenche CI release qui publie 4 artefacts (`arc-linux-x64`, `arc-linux-arm64`, `*.sha256` x2)
- [ ] SHA256 vérifiable : `sha256sum -c arc-linux-x64.sha256` retourne OK
- [ ] `docs/E2E-test-procedure.md` §1 ne contient plus `git clone`
- [ ] `docs/installation.md` existe, copiable, testée par l'utilisateur en moins de 5 min
- [ ] `docs/release-process.md` existe et liste la SOP step-by-step
- [ ] Smoke E2E réel (1f) passé : tag `v0.1.0-rc.1` → CI verte → install fresh sur VPS jetable → `arc setup --apply` OK

## Fichiers concernés (estimation)

### Création
- `docs/03-architecture-decisions/0016-distribution-strategy.md` (1a-bis)
- `docs/installation.md` (1e)
- `docs/release-process.md` (1e)
- `dist/install/install.sh` ou hosting Cloudflare Pages config (1d)

### Modification
- `docs/03-architecture-decisions/README.md` — index ADR (1a-bis)
- `tasks/INDEX.md` — entry DIST-001 + DIST-002/003/004 backlog (déjà fait à l'activation)
- `packages/arc-cli/install.sh` — host `install-arc.euglowlabs.com` + SHA256 verify + `ARC_VERSION` pin (1b)
- `packages/arc-cli/scripts/build-binaries.mjs` — `--define` flags version/sha/date (1a)
- `packages/arc-cli/src/index.ts` ou `commands/version.ts` — lecture `__ARC_*__` (1a)
- `packages/arc-cli/src/commands/upgrade.ts` ou similaire — stub `arc upgrade` informationnel (1a)
- `packages/arc-cli/package.json` — éventuellement script `build:embed` selon spike (1a)
- `.github/workflows/publish.yml` → `release.yml` v2 — trigger `git tag v*.*.*`, linux x64+arm64 only, SHA256 (1c)
- `docs/E2E-test-procedure.md` §1 — remplacer `git clone` par `curl` (1e)
- `packages/arc-cli/README.md` — section Installation (1e)
- `README.md` racine — badge install + lien `docs/installation.md` (1e)

### Touche playbooks (si spike Bun KO → plan B)
- `packages/arc-cli/playbooks/` — déplacement éventuel depuis racine (à décider en 1a selon résultat spike)

## ADRs liés

- **ADR-0002** — Bun runtime CLI (`bun build --compile`)
- **ADR-0006** — Apache 2.0 OSS
- **ADR-0012** — Single-machine install model
- **ADR-0015** — Layout artefacts utilisateur sous `~/.arc/`
- **ADR-0016** — Distribution & packaging strategy *(à créer en 1a-bis)*

## Conventions à respecter

- `docs/04-conventions/git-workflow.md` — Conventional Commits avec `[DIST-001]` scope
- `docs/04-conventions/coding-style.md` — TypeScript strict, zéro `any`
- `docs/04-conventions/naming.md` — produit = "EuglowLabs ARC", binary = `arc`, monorepo = `euglowlabs-arc`
- `docs/04-conventions/pr-review.md` — 1 PR par sous-tâche logique, < 5 fichiers/PR si possible
- `CLAUDE.md` — TypeScript strict, pas de secret en dur, commit atomique par sous-tâche

## Hors scope (NE PAS faire)

- ❌ Cosign / Sigstore signing → backlog `DIST-002`
- ❌ `arc self-update` réel (téléchargement + atomic-replace + verify) → backlog `DIST-003`. Seul un stub informationnel est livré.
- ❌ Builds darwin x64/arm64 + windows x64 publiés en release → backlog `DIST-004` post-bêta. Le code cross-compile reste dans `build-binaries.mjs`, mais ces artefacts ne sont PAS uploadés au release MVP.
- ❌ Image Docker du CLI (option B de D-DIST-1, rejetée)
- ❌ Tarball playbooks séparé du binaire (option C de D-DIST-2, rejetée)
- ❌ Réécrire CLI-025/026/027 archivées. On constate qu'elles étaient incomplètes, on documente dans le rapport de completion DIST-001, on ne rouvre pas l'historique.
- ❌ Rouvrir les questions tranchées dans le cadrage. Si un imprévu force une déviation d'une des 8 décisions actées, STOP et amend ADR-0016 explicitement.

---

## Décisions actées (cadrage validé 2026-05-08)

| ID | Décision | Choix |
|---|---|---|
| **D-DIST-1** | Stratégie binaire | A — Bun `--compile` standalone |
| **D-DIST-2** | Playbooks | A — Embed binaire + fallback tarball inline base64 si spike Bun KO |
| **D-DIST-3** | Hosting | A — `install-arc.euglowlabs.com` via Cloudflare Pages |
| **D-DIST-4** | CI release | Tag `v*.*.*` + linux x64+arm64 only + pas de tarball séparé + SHA256 |
| **D-DIST-5** | Signing | C — SHA256 only ; cosign en backlog DIST-002 |
| **D-DIST-6** | Versioning binaire | `bun build --define __ARC_VERSION__/__ARC_GIT_SHA__/__ARC_BUILD_DATE__` |
| **D-DIST-7** | Update | B — re-curl + stub `arc upgrade` informationnel ; self-update en backlog DIST-003 |
| **D-DIST-8** | Docs | 5 fichiers : E2E-test-procedure.md §1 + arc-cli/README + root README + nouveau `docs/installation.md` + nouveau `docs/release-process.md` |

CLI gaps notés à traiter au moment opportun :
- Réserver `arc.euglowlabs.com` pour produit/dashboard futur (ne PAS l'utiliser pour distribution)
- Audit toutes les ✅ archivées en Phase 1 pour vérifier critères runtime validés (pas dans scope DIST-001 mais à inscrire en post-mortem)
- darwin/windows en backlog post-bêta (DIST-004)

---

## Plan d'implémentation

### Sous-tâche 1a-bis — ADR-0016 distribution strategy ✅
- **Statut** : Terminée 2026-05-08
- **Fichiers livrés** : `docs/03-architecture-decisions/0016-distribution-strategy.md` (créé), `docs/03-architecture-decisions/README.md` (maj index : ajout ADR-0014, ADR-0015, ADR-0016 — boy scout fix orthogonal)
- **Effort réel** : ~30 min
- **Notes** : Diff validé par utilisateur avant écriture. Retouche cosmétique appliquée (concurrence séparée en outils sysadmin / runtimes packagés).

### Sous-tâche 1a — Spike Bun embed playbooks + build standalone ✅
- **Statut** : COMPLÈTE — 5 sous-sous-tâches livrées, smoke binaire E2E validé localement
- **Découpage interne livré** :
  - **1a-1** ✅ Spike Bun embed (méthode B viable, ~50 KB cost)
  - **1a-2** ✅ Codegen + EmbeddedPlaybooksLoader (split en 2 commits `fa9b021` + `1cad8db`)
  - **1a-3** ✅ `bun --define` injection version metadata + `formatVersion()` + `commands/version.ts` enrichi (`ed59f27`)
  - **1a-cleanup** ✅ URL pivot `install.euglowlabs.com` → `install-arc.euglowlabs.com` (`773ba6a`)
  - **1a-4** ✅ Stub `arc upgrade` + ADR-0016 align `| sh` (`0876e8c`)
  - **1a-5** ✅ Smoke binaire compilé E2E linux-x64 + suppression spike script — 4 commandes validées (--version, version, upgrade, setup --help) avec VERSION/SHA/DATE injectés réels (no fallback dev), playbooks embarqués confirmés via grep
- **Cross-target validation** (linux-arm64, darwin-x64/arm64, windows-x64) reportée à **1f** (CI pipeline + git tag rc.1)

### Sous-tâche 1b — Réécriture install.sh ✅
- **Statut** : Terminée 2026-05-08
- **Pivot acté** : Option A (POSIX `sh` strict, pas bash) pour éviter le bug runtime sur Ubuntu 24.04 où `/bin/sh = dash` ignore le shebang lors d'un `curl ... | sh`. Cohérent avec ADR-0016 §3 et `arc upgrade` message.
- **Fichiers livrés** : `packages/arc-cli/install.sh` (REWRITE complet, ~190 lignes)
- **Validations** : `bash -n` ✅, `dash -n` ✅ (POSIX validé), `shellcheck` pas dispo localement (gap noté)
- **Smoke runtime** : reporté à 1f (nécessite GitHub Releases publiés + hosting Cloudflare Pages, livrés en 1c+1d)
- **Effort réel** : ~1h

### Sous-tâche 1c — CI GitHub Actions release v2 ✅
- **Statut** : Terminée 2026-05-08
- **Fichiers livrés** : `.github/workflows/publish.yml` (REWRITE complet, drop job `npm` no-op au profit du focus binaires)
- **Trigger** : `push: tags: [v*.*.*]` + `workflow_dispatch` (input `tag` pour fallback manuel)
- **Pipeline** : checkout (fetch-depth 0) → resolve tag → setup pnpm/Node/Bun → install → pre-flight (lint → typecheck → test → build → build:bin) → SHA256 generation → softprops/action-gh-release@v2 (auto release notes + prerelease detect `-rc`/`-beta`/`-alpha` + fail_on_unmatched_files)
- **Artefacts** : 4 fichiers (arc-linux-x64, arc-linux-arm64, +.sha256 chacun). darwin/windows cross-compilés mais non uploadés (DIST-004 backlog)
- **Validation YAML** : `python yaml.safe_load` ✅, `yamllint` 2 warnings cosmétiques GHA-standard (missing `---`, truthy `on:`) — ignorés par convention communauté
- **Smoke runtime** : reporté à 1f (push de tag `v0.1.0-rc.1` → première vraie release)
- **Effort réel** : ~1h

### Sous-tâche 1d — Hosting install-arc.euglowlabs.com
- **1d-1** ✅ Artefacts repo livrés 2026-05-10 : `scripts/gen-install-page.mjs` + `dist/install/_headers` + `.gitignore` re-include + `package.json` script
- **1d-2** ⏳ Walkthrough Cloudflare en attente collaboration utilisateur (dashboard)
- **1d-3** ⏳ Réservation DNS `arc.euglowlabs.com` (parking record)
- **Fichiers** : configuration Cloudflare (DNS CNAME + Pages project), `dist/install/install.sh` ou alternative selon stratégie Pages, mise à jour `packages/arc-cli/install.sh` pour le host final si ajustement
- **Effort estimé** : ~1h
- **Détail** : Cloudflare Pages connecté à un dossier `dist/install/` (ou un repo dédié si simpler). DNS CNAME `install` → cible Pages. Header `Content-Type: text/plain; charset=utf-8` via `_headers` Pages. Vérification : `curl -I https://install-arc.euglowlabs.com` → 200, content-type OK, body = install.sh actuel. **Action côté Cloudflare dashboard utilisateur requise** — collaboration nécessaire.
- **Dépendances** : 1b (install.sh dans son état final)
- **Livrable** : URL `install-arc.euglowlabs.com` qui sert l'install.sh à jour, CNAME en place

### Sous-tâche 1e — Mise à jour des 5 docs
- **Fichiers** : `docs/E2E-test-procedure.md` (modif §1), `packages/arc-cli/README.md` (section Installation), `README.md` racine (badge + lien), `docs/installation.md` (nouveau), `docs/release-process.md` (nouveau)
- **Effort estimé** : ~1h
- **Détail** : Remplacer chaîne `git clone https://github.com/...` par one-liner curl partout. Créer `docs/installation.md` user-facing (pré-requis VPS Ubuntu, one-liner, vérification version, troubleshooting top 3). Créer `docs/release-process.md` interne (SOP : changeset → tag → push → vérifier CI → smoke VPS → annonce).
- **Dépendances** : 1d (les docs pointent vers `install-arc.euglowlabs.com` qui doit exister)
- **Livrable** : 5 fichiers maj/créés, lecture cohérente bout-en-bout

### Sous-tâche 1f — Smoke test E2E réel du pipeline
- **Fichiers** : aucun (validation manuelle), éventuellement `docs/release-process.md` complété par retours d'expérience
- **Effort estimé** : 1-2h selon imprévus
- **Détail** : Couper tag `v0.1.0-rc.1` → push → attendre CI verte → provisionner VPS Ubuntu 24.04 jetable → `curl -fsSL https://install-arc.euglowlabs.com | sh` → `arc version` → `arc setup --apply` → `sudo bash scripts/smoke-test.sh` (en récupérant le script via `curl raw`). Aucun `git clone`. Si tout passe : tag final `v0.1.0`. Si bug : retour sur la sous-tâche concernée, nouveau RC.
- **Dépendances** : 1a + 1b + 1c + 1d + 1e
- **Livrable** : VPS de test validé, captures de logs, GO ou NO-GO documenté dans le rapport de completion

**Total estimation** : 8h cumulées, étalable sur 1-2 jours selon disponibilité Cloudflare et imprévus 1a/1f.

> ⚠️ Le skill `/arc-task-start` recommande sous-tâches < 30min. Ici : 1a-bis = 30min ✅, mais 1a (~2h), 1c (~2h), 1f (1-2h) dépassent. C'est un pattern macro-tâches assumé (cohérent avec ANSIBLE-001a/b/c en Phase 1.5). Chaque sous-tâche reste un livrable atomique commitable seul.

---

## Scratchpad

### 2026-05-08 — Activation
- Cadrage validé par utilisateur. 8 décisions actées + 6 sous-tâches.
- Constat : CLI-025/026/027 archivées ✅ mais en réalité pipeline jamais bouclé. DIST-001 = finalisation latente + show-stopper playbooks embed.
- Risque technique #1 : spike Bun embed YAML arborescent (1a, 30 min). Plan B documenté = tar.gz inline base64.
- Risque #2 : Cloudflare config (1d) requiert accès dashboard utilisateur — collaboration nécessaire au moment de 1d.

### 2026-05-08 — 1a-bis livrée (ADR-0016)
- ADR-0016 écrit avec retouche cosmétique sur la phrase concurrence (sysadmin tools vs runtimes packagés).
- Index ADR README enrichi : ajout ADR-0014, ADR-0015, ADR-0016 (boy scout fix, gap pré-existant).
- Prochaine sous-tâche : **1a — Spike Bun embed playbooks + build standalone**. À confirmer par utilisateur.

### CLI gaps notés (à traiter au moment opportun)
- ⚠️ **Réserver `arc.euglowlabs.com` dans Cloudflare DNS dès cette semaine** (cohérent ADR-0016 §3) — empêcher la prise du sous-domaine par un tiers avant que la décision soit appliquée.
- Audit toutes les ✅ archivées en Phase 1 pour vérifier critères runtime validés (post-mortem hors scope DIST-001).
- darwin/windows en backlog post-bêta (DIST-004) — code cross-compile conservé dans `build-binaries.mjs`.
- **`arc cache clear`** pour nettoyer `~/.arc/playbooks/<oldversion>/` après upgrade (DIST-001 1a-2 / 1a-3).
- **CONTRIBUTING.md futur** : documenter que `pnpm gen:manifest` régénère le manifest (et que `pre*` hooks le font automatiquement) — DIST-001 1a-2.
- **ADR-0016 cleanup** : note "+200-500 KB binaire gonflement" surévaluée 10× (réalité ~50 KB), à corriger.
- **Versions futures avec caractères spéciaux SemVer** (ex: `0.1.0-rc.1+build.123`) : tester que `bun --define` les accepte sans escape — probablement OK via `spawnSync` array, à valider en 1a-5 ou plus tard. DIST-001 1a-3.
- **Vérifier paths Ansible relatifs** : pendant 1a-5 (smoke binaire), s'assurer que les rôles Ansible résolvent leurs paths relatifs depuis `arcPlaybooksDir(VERSION)` (et non depuis cwd).
- **Convention de nommage URLs install** : `install-<produit>.euglowlabs.com` strict (cf. ADR-0016 §3). Si plusieurs sous-domaines deviennent partagés (releases-arc, docs-arc, etc.), envisager un ADR séparé "EuglowLabs URL conventions" pour figer la convention noir-sur-blanc.
- **Cleanup orthogonal `arc.euglowlabs.com/install.sh` à compléter en 1b/1e** : `README.md`, `docs/02-spec-arc-product.md`, `docs/03-architecture-decisions/0011-end-to-end-install-acceptance.md`, `docs/03-architecture-decisions/0012-single-machine-install.md`, `docs/04-conventions/naming.md`, `docs/migration-guide.md`, `tasks/INDEX.md` (entrée historique CLI-027) référencent encore `arc.euglowlabs.com/install.sh`. Ces références pré-DIST-001 doivent migrer vers `install-arc.euglowlabs.com` lors de la sous-tâche 1b (réécriture install.sh) ou 1e (sweep docs).
- **Validation 1d Cloudflare** : configurer Cloudflare Pages pour `install-arc.euglowlabs.com` ET vérifier que `install.euglowlabs.com` (sans suffixe) reste libre/non-monopolisé (DNS non créé pour ce nom).
- **install.sh + ARC_INSTALL_DIR dans `$HOME`** : edge case détecté en 1b — si l'utilisateur fait `curl ... | ARC_INSTALL_DIR=$HOME/.local/bin sh` depuis un compte non-root, le `$SUDO mv` produit un fichier owned `root:root` dans son propre `$HOME`. Ironique. Fix futur : skip sudo si `INSTALL_DIR` est sous `$HOME`. Pas blocker MVP.
- **Shellcheck en CI** : `shellcheck install.sh` à ajouter au workflow GitHub Actions (sous-tâche 1c) ou en pre-commit hook lefthook. Validation locale impossible faute d'install.
- **Vérifier docs/installation.md existe au tag** : le next-steps message d'`install.sh` link `docs/installation.md` (sera créé en 1e). Vérifier en 1f (avant `v0.1.0-rc.1`) que le fichier est bien présent sur `main`.

### 2026-05-10 — 1d-1 livrée (Cloudflare Pages artefacts)
- 4 décisions design tranchées et tracées dans `.claude/prompts-history.json` (2026-05-10-001 entrée 2) :
  - Q1 stratégie : copy-on-build via `pnpm gen:install-page` (gitignored mirror)
  - Q2 URL : `dist/install/index.html` + `_headers` Content-Type override (no _redirects)
  - Q3 script : `scripts/gen-install-page.mjs` à la racine (rejoint pattern `generate-playbooks-manifest.mjs`)
  - Q4 périmètre : 5 fichiers épurés (sans README ni .gitkeep)
- Fichiers livrés : 5 (script gen + _headers + .gitignore + package.json + current.md)
- Source de vérité unique : `packages/arc-cli/install.sh` (D-DIST-3, ADR-0016 §3) — mirror gitignoré, drift impossible
- **1d-2 walkthrough Cloudflare en attente collaboration utilisateur** : créer projet Pages connecté à `johannKionghat/EUGLOWLABS-ARC` branch `main`, build cmd `pnpm gen:install-page`, output dir `dist/install`, custom domain `install-arc.euglowlabs.com`, vérification `curl -I` → 200 + Content-Type text/plain
- **1d-3 réservation `arc.euglowlabs.com` DNS** : à exécuter en parallèle de 1d-2 côté Cloudflare DNS (parking record, pas de Pages binding)
- **Gap opérationnel** : commit `366a0cf` (1c) toujours en attente de push origin/main — bloqué par PAT scope `workflow` manquant. À débloquer avant 1f.
