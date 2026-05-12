# CLI-029 — Auto-bootstrap system prerequisites in `arc setup --apply`

**Priorité : HIGH — bloque tag stable v0.1.0 et adoption end-user.**
**Statut : 🟡 En cours — démarrée le 2026-05-12.**

## Contexte

DIST-001 a livré le pipeline de distribution complet
(`curl install-arc.euglowlabs.com | sh` → `arc` installé en
`/usr/local/bin/`, SHA256 vérifié, prerelease `v0.1.0-rc.1` accessible
publiquement). Smoke 1f-A validé in-vivo sur VMware Ubuntu 24.04 :

```
arc 0.1.0-rc.1 (sha=d125942, built=2026-05-12T18:59:43.659Z)
```

Lors de la tentative de smoke 1f-B (`arc setup --apply` complet), un gap
UX a été identifié : `arc setup --apply` suppose `ansible-playbook`,
`python3`, `docker` et `sudo` déjà installés sur la machine cible. Si
l'un d'eux manque, la commande échoue avec un message peu actionnable.

**Cela contredit directement ADR-0011 A3** :

> A3 — `arc setup` lancé sur un VPS Ubuntu 24.04 vierge mène à une stack
> fonctionnelle en moins de 15 minutes, **sans intervention manuelle
> entre les questions**.

Une VM Ubuntu 24.04 fresh n'a PAS Ansible installé par défaut. L'utilisateur
final doit donc actuellement faire `sudo apt install -y ansible` à la
main — c'est exactement l'intervention manuelle que ADR-0011 A3 interdit.

## Objectif

`arc setup --apply` doit s'auto-bootstrapper : détecter les prérequis
système manquants, demander consentement à l'utilisateur (1 prompt
unique), puis les installer automatiquement via le package manager
détecté avant de lancer le playbook Ansible.

Référence comportementale : `curl get.docker.com | sh`, `k3s install`,
`curl coolify.io/install | sh` — tous font ce bootstrap automatique.

## Cible utilisateur

Utilisateur final ARC qui vient de faire
`curl install-arc.euglowlabs.com | sh`. Il tape `arc setup --apply` sur
sa VM fresh et **tout doit se dérouler sans rien d'autre à installer
manuellement**.

## Critères d'acceptance

- [ ] `arc setup --apply` sur Ubuntu 24.04 fresh (sans Ansible, sans Docker)
      détecte les manques, demande consentement (1 prompt OUI/NON
      unique), installe puis continue le déroulé Ansible.
- [ ] Si l'utilisateur refuse l'auto-install, `arc setup --apply` sort
      avec un message clair listant les commandes manuelles à exécuter
      (`sudo apt install -y ansible`...).
- [ ] Détection package manager : apt (Ubuntu/Debian) en MVP. dnf
      (Fedora/RHEL) et autres reportés selon demande.
- [ ] Prérequis bootstrappés en MVP : `ansible-core >= 2.16`, `python3
      >= 3.10`, `docker` (via le script officiel ou apt), `curl`
      (pour bootstrapping additionnel si besoin).
- [ ] `sudo` est vérifié en amont (si le user n'est pas root et
      n'a pas sudo → message clair).
- [ ] Tests Vitest unitaires sur la logique de détection
      (mock `which` / `apt list --installed`).
- [ ] Smoke E2E : provisionner VM Ubuntu 24.04 fresh,
      `curl install-arc | sh && arc setup --apply` → stack opérationnelle
      en < 15 min sans intervention manuelle.
- [ ] Doc `docs/installation.md` mise à jour : section "Prerequisites"
      simplifiée à "Linux x64/arm64 + sudo + curl" (le reste auto-installé).
- [ ] ADR-0011 critère A3 effectivement satisfait.

## Plan d'implémentation

Analyse du code existant (effectuée 2026-05-12) :

- **Point d'injection identifié** : `packages/arc-cli/src/setup/apply.ts:294-308` —
  step 1 d'`applyStack` capture `AnsibleNotInstalledError` levé par
  `assertAnsibleInstalled(adapter)`, affiche `ANSIBLE_NOT_INSTALLED_MESSAGE` via
  `cancel()` et retourne `EXIT_ENV_ERROR`. CLI-029 = brancher la logique
  bootstrap **dans ce catch**, AVANT le cancel, avec un retry une fois
  l'install terminée.
- **Pattern existant à réutiliser** : `@clack/prompts` (`note`, `cancel`,
  `select`, `confirm`) déjà importé (apply.ts:5).
- **ExecutionAdapter** : abstrait via interface, déjà passé à
  `assertAnsibleInstalled` → réutilisable pour bootstrap commands.

### Décisions design tranchées (pas d'ADR nécessaire — implémentation de
ADR-0011 A3, choix cohérents avec contexte existant) :

- **D1 — Scope OS** : apt MVP (Ubuntu/Debian). Fallback fail-clear pour autres
  distros (reuse `ANSIBLE_NOT_INSTALLED_MESSAGE`). Cohérent avec
  `docs/installation.md` qui targets explicitement Ubuntu 24.04 LTS / Debian 12.
- **D2 — Mode prompt** : prompt UNIQUE @clack `confirm` ("Installer Ansible
  automatiquement via sudo apt ? [oui/non]"). Si non → fail-clear avec
  instructions manuelles. Pas de flag `--auto-install`.
- **D3 — Prérequis bootstrappés en MVP** : **Ansible uniquement**. python3
  arrive en dépendance apt auto. Docker est installé par le playbook Ansible
  lui-même (rôle existant). sudo est checké, pas installé.
- **D4 — Stratégie sudo** : on suppose sudo accessible (cohérent avec install.sh
  qui a déjà demandé sudo lors de l'install du binaire dans /usr/local/bin/).
  Si sudo absent → fail-clear avec instructions.

### Sous-tâche 1a — Module `prerequisites.ts` + tests (~35 min)

- **Création** : `packages/arc-cli/src/setup/prerequisites.ts`
  - `detectPackageManager(adapter): Promise<'apt' | 'unknown'>` —
    test si `apt-get` est dans le PATH via `which apt-get`
  - `checkSudoAvailable(adapter): Promise<boolean>` —
    test `which sudo` ET `id -u` (root OK aussi, sudo pas requis)
  - Reuse `assertAnsibleInstalled` existant pour la détection Ansible
- **Création** : `packages/arc-cli/src/setup/prerequisites.test.ts`
  - Mock `ExecutionAdapter.exec` pour 4 scénarios :
    - apt présent + sudo OK
    - apt absent (autre distro)
    - sudo absent, user non-root
    - user root direct (pas besoin de sudo)
- **Livrable** : 2 fichiers, ~3-4 tests Vitest verts.

### Sous-tâche 1b — Module `bootstrap.ts` + tests (~35 min)

- **Création** : `packages/arc-cli/src/setup/bootstrap.ts`
  - `promptAutoInstallAnsible(): Promise<boolean>` — utilise
    `@clack/prompts.confirm`, message clair listant ce qui sera exécuté
  - `bootstrapAnsibleApt(adapter, sudoPrefix): Promise<Result>` —
    exécute `sudo apt-get update && sudo apt-get install -y ansible`
    via `adapter.exec`, stream stdout/stderr ligne par ligne via `note`
    @clack pour UX moderne, return success/fail
- **Création** : `packages/arc-cli/src/setup/bootstrap.test.ts`
  - Mock prompt + adapter pour valider :
    - User répond "oui" → adapter.exec appelé avec la bonne commande
    - User répond "non" → no-op, return false
    - apt-install exit 0 → Result.ok
    - apt-install exit !=0 → Result.fail avec stderr capturé
- **Livrable** : 2 fichiers, ~4-5 tests Vitest verts.

### Sous-tâche 1c — Intégration dans `apply.ts` + maj `apply.test.ts` (~25 min)

- **Modification** : `packages/arc-cli/src/setup/apply.ts`
  - Dans le catch de `AnsibleNotInstalledError` (ligne ~299) :
    1. Détecter pkg manager + sudo via prerequisites.ts
    2. Si apt + sudo OK → `promptAutoInstallAnsible()`
       - Si "oui" → `bootstrapAnsibleApt()` → re-call `assertAnsibleInstalled`
       - Si "non" → afficher ANSIBLE_NOT_INSTALLED_MESSAGE classique
    3. Si apt absent ou sudo manquant → fallback fail-clear (legacy message)
  - `ApplyStackOptions` : ajouter test seam pour les nouveaux modules
    (DI propre, pas de hack global)
- **Modification** : `packages/arc-cli/src/setup/apply.test.ts`
  - Ajouter ~3 tests pour le nouveau branch :
    - VM Ubuntu sans Ansible → user "oui" → install succeed → continue
    - VM Ubuntu sans Ansible → user "non" → cancel propre
    - VM Fedora sans Ansible (apt absent) → fallback fail-clear
- **Livrable** : `apply.ts` modifié, ~3 tests ajoutés, total tests verts.

### Sous-tâche 1d — Smoke E2E sur VM Ubuntu 24.04 vierge (~30 min)

- **Action utilisateur sur sa VM VMware** (la même que pour 1f-A DIST-001) :
  - `sudo apt remove -y ansible` (simuler une VM vierge)
  - `arc setup --apply`
  - Confirmer le prompt "Installer Ansible automatiquement ?"
  - Vérifier que l'install se déclenche, puis le déroulé Ansible continue
- **Mesurer** : time-to-stack-ready (target < 15 min selon ADR-0011 A3)
- **Si échec** : retour sur la sous-tâche concernée
- **Livrable** : confirmation utilisateur de réussite + logs collectés.

### Sous-tâche 1e — Doc `installation.md` + tag stable `v0.1.0` (~25 min)

- **Modification** : `docs/installation.md`
  - Section "Prerequisites" simplifiée : "Linux x64/arm64 + sudo + curl"
  - Note "Ansible/Python/Docker sont installés automatiquement par arc setup"
- **Bump version** : `packages/arc-cli/package.json` `0.1.0-rc.1` → `0.1.0`
- **Commit** : `chore(release): bump arc-cli to 0.1.0 stable [CLI-029]`
- **Tag** : `git tag -a v0.1.0 -m "ARC CLI 0.1.0 stable — CLI-029 auto-bootstrap"`
- **Push** : `git push origin main && git push origin v0.1.0` → CI publish.yml
  déclenche → release stable v0.1.0 publique
- **Livrable** : tag stable v0.1.0 en prod, smoke fonctionnel pour utilisateur
  sans pin `ARC_VERSION`.

**Total estimé : ~2h30 cumulées sur 5 sous-tâches.**

## Scratchpad

### 2026-05-13 — 1a + 1b livrées

- **1a ✅** (commit `56aa7b5`) : `prerequisites.ts` pure-detection module +
  5 tests Vitest. Exports `PackageManager`, `SudoStatus`,
  `detectPackageManager`, `checkSudoAvailable` (short-circuit root).
- **1b ✅** (commit en cours) : `bootstrap.ts` interactive auto-install +
  5 tests. Exports `BootstrapResult`, `promptAutoInstallAnsible`
  (@clack confirm avec note transparente sur les commandes exécutées),
  `bootstrapAnsibleApt` (chaîne `&&` avec DEBIAN_FRONTEND=noninteractive,
  stream stdout via onChunk).
- Total tests CLI-029 ajoutés : 10 (5 + 5). Total repo passe à 195
  (183 → 188 arc-cli, 7 shared).
- **Next : 1c** — intégration dans `apply.ts:295-308` (catch
  `AnsibleNotInstalledError` → détection prérequis via 1a → prompt via
  1b → bootstrap → retry `assertAnsibleInstalled`). Test seam dans
  `ApplyStackOptions` pour DI.

## Fichiers concernés (estimation)

### Création
- `packages/arc-cli/src/setup/prerequisites.ts`
- `packages/arc-cli/src/setup/bootstrap.ts`
- `packages/arc-cli/src/setup/prerequisites.test.ts`
- `packages/arc-cli/src/setup/bootstrap.test.ts`

### Modification
- `packages/arc-cli/src/setup/apply.ts` — appel bootstrap en tête de pipeline
- `docs/installation.md` — section Prerequisites simplifiée
- `docs/release-process.md` — référence au flow auto-bootstrap

## ADRs liés

- **ADR-0011** — *End-to-end install acceptance*. Critère A3 (motivation principale).
- **ADR-0012** — *Single-machine install*. Le bootstrap se fait sur la cible (localhost).
- **ADR-0016** — *Distribution & packaging strategy*. Complète la promesse DIST-001.

## Hors scope (NE PAS faire)

- ❌ Multi-OS coverage (macOS, Windows) → backlog DIST-004.
- ❌ Rocky/AlmaLinux/CentOS support dnf — reporté à V2 si demande communauté.
- ❌ Auto-install des credentials Cloudflare/R2 — par design utilisateur fournit (privacy + sécurité).
- ❌ Réimplémenter docker-ce comme dépendance pinnée — utiliser script officiel Docker (`curl get.docker.com | sh`) ou paquet apt selon politique.

## Bloque

- 🔴 **Tag stable `v0.1.0`** — actuellement on garde `v0.1.0-rc.1` en
  dernière release tant que CLI-029 n'est pas livré. Tagger v0.1.0
  stable AVANT que ce ticket soit fermé exposerait les end-users à un
  `arc setup --apply` qui plante.
- Onboarding fluide solo founders (cible business du projet).

## Pas bloqué par

- DIST-001 (✅ livré 2026-05-12, périmètre distribution & packaging
  validé sur smoke 1f-A).
- LOCAL-001 (mode WSL/laptop, orthogonal).
- Phase 2 ARC Agent, Phase 3 Dashboard.

## Notes opérationnelles

- Le script Docker officiel (`get.docker.com`) demande `sudo` lui aussi.
  Donc le bootstrap demande sudo une fois (au début) pour tout l'enchaînement.
- Ansible installé via apt sur Ubuntu 24.04 → version 9.x (ansible-core
  2.16+) → compatible avec nos playbooks.
- En cas d'OS non-supporté (e.g., Alpine, Arch), le bootstrap fail-clear
  avec message « OS non supporté en MVP — voir CLI-029 backlog ».
- Le script `install.sh` (DIST-001 1b) reste minimaliste (juste
  télécharger le binaire) — la complexité bootstrap est dans le binaire,
  pas dans install.sh.
