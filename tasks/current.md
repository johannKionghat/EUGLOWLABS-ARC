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

### Sous-tâche 1a — Spike Bun embed playbooks + build standalone
- **Statut** : 1a-1 ✅, 1a-2 ✅, 1a-3 ✅, 1a-4 ⬜, 1a-5 ⬜
- **Découpage interne livré** :
  - **1a-1** ✅ Spike Bun embed (méthode B viable, ~50 KB cost) — `scripts/spike-bun-embed.mjs`
  - **1a-2** ✅ Codegen + EmbeddedPlaybooksLoader (split en 2 commits `fa9b021` + `1cad8db`)
  - **1a-3** ✅ `bun --define` injection version metadata + `formatVersion()` + `commands/version.ts` enrichi
  - **1a-4** ⬜ Stub `arc upgrade` (~10 min)
  - **1a-5** ⬜ Smoke binaire compilé E2E + suppression du spike script (~15 min)

### Sous-tâche 1b — Réécriture install.sh
- **Fichiers** : `packages/arc-cli/install.sh`
- **Effort estimé** : ~1h
- **Détail** : Changer host `arc.euglowlabs.com` → `install-arc.euglowlabs.com`. Ajouter vérification SHA256 (download du `.sha256` puis `sha256sum -c`). Support `ARC_VERSION` pin (déjà partiellement présent). Garder fallback wget. Ajouter linting shellcheck en CI (job léger).
- **Dépendances** : aucune (peut tourner en parallèle de 1a)
- **Livrable** : install.sh testable manuellement avec `ARC_VERSION=v0.1.0-rc.1`

### Sous-tâche 1c — CI GitHub Actions release v2
- **Fichiers** : `.github/workflows/release.yml` (nouveau, remplace `publish.yml` ou cohabite), `.github/workflows/publish.yml` (deprecate ou supprimer)
- **Effort estimé** : ~2h
- **Détail** : Trigger sur push de tag `v*.*.*`. Steps : checkout, install pnpm/Bun, build, build:bin (linux x64+arm64 only via `--target=bun-linux-x64` et `bun-linux-arm64`), génère SHA256 (`sha256sum arc-linux-x64 > arc-linux-x64.sha256`), crée release GitHub avec body autogénéré (changesets ou git log depuis last tag), upload 4 artefacts. Conserve les builds darwin/windows en local mais ne les publie pas.
- **Dépendances** : 1a (build-binaries.mjs doit accepter --define version)
- **Livrable** : workflow YAML + un dry-run via `act` ou commit sur branche staging avec tag de test puis cleanup

### Sous-tâche 1d — Hosting install-arc.euglowlabs.com
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
