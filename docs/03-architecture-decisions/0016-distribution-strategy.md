# ADR-0016 : Distribution & packaging strategy

## Statut
Accepté
Date : 2026-05-08

## Contexte

Phase 1 a livré 3 tâches censées clore le pipeline de distribution :
- CLI-025 — `bun build --compile` cross-target (5 binaires linux/darwin/windows)
- CLI-026 — Publication npm + Homebrew + GitHub Releases
- CLI-027 — Script `install.sh` + endpoint `arc.euglowlabs.com/install.sh`

Toutes trois marquées ✅ dans `tasks/INDEX.md`. La réalité après audit en Phase 1.6 :

- `publish.yml` est en `workflow_dispatch` (trigger manuel uniquement, pas de `git tag v*.*.*`)
- Aucune release n'a jamais été publiée sur GitHub Releases
- `install-arc.euglowlabs.com` n'a jamais été enregistré DNS ni hébergé
- **Les playbooks Ansible vivent dans `packages/arc-cli/playbooks/` (résolus via `package.json#files`) mais ne sont pas embarqués dans le binaire compilé** — show-stopper : `bun build --compile` n'inline pas automatiquement les fichiers référencés par chemin filesystem au runtime ; un binaire téléchargé seul ne peut pas exécuter `arc setup --apply`
- `homebrew/arc.rb` est un skeleton non publié (tap inexistant)
- `npm publish` est skip car `NPM_TOKEN` absent

Conséquence : `docs/E2E-test-procedure.md` §1 (livré E2E-001 le 2026-05-08) instruit l'utilisateur de cloner le repo via `git clone https://github.com/johannKionghat/EUGLOWLABS-ARC.git`. Inacceptable pour un produit qui se veut "Vercel + Supabase + Ollama-like en self-hosted" : signal de DX bricolée, dépendance implicite sur `git`, pas de versioning, aucune signature.

Référence concurrence — Coolify, Tailscale, Docker (outils sysadmin self-hosted) ; Bun, Deno (runtimes packagés CLI). Tous distribués via `curl <host>/install.sh | sh`. C'est l'attendu industriel 2025+.

ADR-0002 a déjà figé le runtime (Bun) et le mode de packaging (`bun build --compile`). Cet ADR-0016 fige la **stratégie de distribution autour du binaire** : où vivent les playbooks, comment le binaire est versionné, où vit `install.sh`, comment le pipeline release est déclenché, comment l'intégrité est garantie, comment l'utilisateur upgrade, et quelle documentation est canonique.

## Décision

EuglowLabs ARC adopte une stratégie de distribution **single-binary self-contained**, alignée sur Coolify/Tailscale/Bun, structurée en 8 décisions (D-DIST-1 à D-DIST-8 du cadrage DIST-001) :

### 1. Binaire (D-DIST-1) + versioning (D-DIST-6)

Le CLI `arc` est distribué comme **binaire Bun standalone** compilé via `bun build --compile`, un fichier par couple OS/arch. Pas d'image Docker du CLI (le CLI doit toucher le système hôte : UFW, fail2ban, Docker daemon, `/usr/local/bin/`).

Versioning au build via flags `bun build --define` :
- `__ARC_VERSION__` — depuis `packages/arc-cli/package.json#version`
- `__ARC_GIT_SHA__` — `git rev-parse --short HEAD`
- `__ARC_BUILD_DATE__` — ISO 8601 UTC du moment du build CI

`arc version` lit ces constantes et imprime `0.1.0 (sha=abc123, built=2026-05-08T12:34:56Z)`.

### 2. Playbooks (D-DIST-2)

Les playbooks Ansible (`packages/arc-cli/playbooks/`) sont **embarqués dans le binaire**. Stratégie :
1. **Préférence** : `import` Bun de fichiers texte (`bun build --compile` les inline). À valider par spike de 30 min en début de DIST-001 sous-tâche 1a.
2. **Fallback si spike KO** : compresser `playbooks/` en `playbooks.tar.gz` au build, l'inliner en base64 via `--define`, l'extraire vers `~/.arc/playbooks/<version>/` au premier run du binaire.

Dans les deux cas, **un binaire `vX.Y.Z` contient les playbooks `vX.Y.Z`** : zéro drift de version, install offline-friendly, UX one-command.

Rejeté : tarball signé téléchargé au runtime (complexité CDN/signature) ; clone GitHub au runtime (dépendance `git`, surface MITM).

### 3. Hosting + CI release + signing + update (D-DIST-3+4+5+7)

**Hosting `install.sh`** : `https://install-arc.euglowlabs.com/` via Cloudflare Pages, source = `dist/install/install.sh` du repo, auto-publié au push. CNAME DNS `install-arc` → Pages target. `arc.euglowlabs.com` est **réservé au futur produit Dashboard hébergé / Cloud** et explicitement non utilisé pour la distribution.

**Convention de nommage stricte** : `install-<produit>.euglowlabs.com`. Chaque produit EuglowLabs (ARC, EuglowLabs Dev, futurs) a son propre sous-domaine d'install — pas de monopolisation de la racine `install.euglowlabs.com` par un seul produit. Le sous-domaine sans suffixe `install.euglowlabs.com` reste **explicitement libre** (ni réservé à ARC, ni alloué à un autre produit) pour préserver le namespace produit.

**CI release** : workflow GitHub Actions déclenché sur push de tag `v*.*.*`. Steps : build cross-compile linux x64 + linux arm64 depuis `ubuntu-latest` (Bun cross-compile, pas de runner ARM). Génération de SHA256 par binaire. Création GitHub Release avec body autogénéré (changesets ou git log depuis dernier tag). Upload de 4 artefacts : `arc-linux-x64`, `arc-linux-arm64`, `arc-linux-x64.sha256`, `arc-linux-arm64.sha256`.

Pas de tarball playbooks séparé (déjà embarqué). Pas de release darwin/windows (backlog DIST-004 post-bêta — le code cross-compile reste dans `build-binaries.mjs` mais n'est pas publié).

**Signing MVP** : SHA256 checksums uniquement (`sha256sum -c arc-linux-x64.sha256`). Confiance = TLS Cloudflare + GitHub Releases TLS, modèle Coolify/Bun/Tailscale. Cosign + Sigstore reportés en backlog `DIST-002`.

**Update mechanism** : re-curler `install.sh` (idempotent). Stub `arc upgrade` qui imprime simplement le one-liner et la version courante. Self-update réel (téléchargement + atomic-replace + verify + sudo) reporté en backlog `DIST-003`.

### 4. Documentation (D-DIST-8)

Cinq fichiers maintenus comme source de vérité utilisateur et opérateur :
1. `docs/installation.md` (nouveau) — guide canonique user-facing : pré-requis, one-liner, vérification, troubleshooting top 3
2. `docs/release-process.md` (nouveau) — SOP interne pour l'auteur : changeset → tag → push → vérifier CI → smoke VPS jetable → annonce
3. `docs/E2E-test-procedure.md` §1 — `git clone` retiré, remplacé par one-liner curl
4. `packages/arc-cli/README.md` — section Installation (curl + npm + checksum)
5. `README.md` racine — badge install + lien vers `docs/installation.md`

## Conséquences

### Bénéfices
+ **Modèle mental aligné sur Coolify/Tailscale** — courbe d'apprentissage nulle pour les utilisateurs venant du selfhost
+ **Atomicité de version garantie** — un binaire `vX.Y.Z` contient ses playbooks `vX.Y.Z`, impossible de drift
+ **Install offline-friendly** — corporate VPS sans accès libre aux CDN supportés
+ **Pipeline release reproductible** — tag = release, fini les `workflow_dispatch` manuels
+ **Distribution sans `git` ni accès au repo source** — l'utilisateur lambda n'est plus exposé au code
+ **CI minimaliste** — build linux x64+arm64 depuis un seul runner `ubuntu-latest`, ~3 min de build vs ~15 min en QEMU/multi-runner
+ **Surface produit propre** — `arc.euglowlabs.com` réservé au Dashboard/Cloud futur, distribution isolée sur `install-arc.euglowlabs.com` (convention multi-produits `install-<produit>.euglowlabs.com`)

### Compromis acceptés
- **Pas de signature cryptographique en MVP** — risque MITM théorique si TLS de Cloudflare ou GitHub Releases compromis. Mitigation : SHA256 checksums fournis, ajout cosign en `DIST-002` post-Chantier-1.
- **Pas de self-update** — l'utilisateur doit re-curler. UX inférieure à `arc self-update`. Mitigation : `arc upgrade` informatif, doc claire, ajout `DIST-003` post-Chantier-1.
- **Pas de release macOS/Windows** — exclut le cas "dev local sur Mac qui veut juste essayer `arc init`". Acceptable : ADR-0012 acte que l'install se fait sur la cible Linux. Mitigation : code cross-compile conservé, `DIST-004` post-bêta sur demande communauté.
- **Dépendance Cloudflare Pages** — si Cloudflare devient indisponible, `install-arc.euglowlabs.com` tombe. Mitigation : artefacts release toujours téléchargeables via GitHub raw URL, install.sh peut être copié-collé en cas d'incident majeur.
- **Embed playbooks gonfle le binaire** — estimation : +200-500 KB selon arborescence YAML+Jinja2. Acceptable vs le bénéfice d'atomicité. Si ça devient critique (>5 MB), repivoter vers tarball au runtime, mais peu probable avant longtemps.

## Alternatives rejetées

- **Image Docker du CLI** — nécessiterait `--privileged --pid=host` pour toucher le système hôte. Anti-pattern produit. Aucun concurrent direct ne le fait.
- **Combo binaire + Docker** — double maintenance pour zéro cas d'usage que le binaire seul ne couvre pas. YAGNI.
- **Tarball playbooks téléchargé au runtime** — complexité CDN, signature, retry logic, gestion cache. Le bénéfice d'atomicité de version disparaît.
- **Clone GitHub au runtime** — dépendance `git`, latence, surface MITM, pas de cohérence binaire/playbooks.
- **`install.euglowlabs.com`** (sans suffixe produit) — REJETÉ : monopolise la racine `install.*` pour un seul produit, incompatible avec la roadmap multi-produits EuglowLabs (ARC, EuglowLabs Dev, futurs). La convention `install-<produit>.euglowlabs.com` préserve le namespace.
- **`get.euglowlabs.com`** — REJETÉ pour la même raison (monopolise `get.*` pour ARC). Convention `install-<produit>.euglowlabs.com` retenue.
- **GitHub raw URL pour `install.sh`** — URL fragile au rename, branding pauvre, pas de CDN sérieux.
- **Cosign / Sigstore en MVP** — UX coûteux pour 99% des utilisateurs qui ne vérifient pas. Reportable sans dette technique.
- **GPG signing** — key management = friction garantie, valeur perçue nulle vs Cosign pour MVP.
- **`arc self-update` en MVP** — mini-feature à 4-6h (API GitHub rate-limit, atomic-replace, sudo, verify). `curl ... | sh` est idempotent et suffit.
- **Release macOS/Windows en MVP** — coût CI matrix + zéro cas d'usage Phase 1.5 (CLI tourne sur la cible Linux per ADR-0012).

## Notes de mise en œuvre

- Spike Bun embed YAML arborescent **avant tout commit de code** sur 1a. Si KO, pivoter explicitement vers le plan B tarball+base64 et le documenter dans le scratchpad de `tasks/current.md`. Ne pas amend cet ADR pour autant : le résultat fonctionnel reste "playbooks embarqués dans le binaire".
- Toutes les références hardcodées au host `arc.euglowlabs.com` dans `install.sh` doivent passer à `install-arc.euglowlabs.com` (cohérent avec décision §3 et la convention multi-produits `install-<produit>.euglowlabs.com`).
- Tag de référence pour le smoke E2E : `v0.1.0-rc.1` (pré-release, ne déclenche pas l'annonce). Tag final `v0.1.0` après GO smoke.
- Backlog créé : `DIST-002` (cosign), `DIST-003` (self-update), `DIST-004` (release darwin/windows). Inscrits dans `tasks/INDEX.md` Phase 1.6.
