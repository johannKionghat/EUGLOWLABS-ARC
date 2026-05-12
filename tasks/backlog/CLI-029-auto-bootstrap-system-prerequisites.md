# CLI-029 — Auto-bootstrap system prerequisites in `arc setup --apply`

**Priorité : HIGH — bloque tag stable v0.1.0 et adoption end-user.**
**Statut : backlog post-DIST-001.**

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

## Plan d'implémentation (estimation)

### Sous-tâche 1a — Détection prérequis (~1h)
- Module `packages/arc-cli/src/setup/prerequisites.ts` :
  - `detectPackageManager()` → 'apt' | 'dnf' | 'unknown'
  - `checkPrerequisites()` → `{ ansible: bool, python3: bool, docker: bool, sudo: bool }`
- Tests Vitest avec mock execa

### Sous-tâche 1b — Bootstrap interactif (~1h)
- Module `packages/arc-cli/src/setup/bootstrap.ts` :
  - `promptBootstrap(missing)` → prompt @clack OUI/NON
  - `installPrerequisites(missing, pkgMgr)` → exécute apt/dnf
  - Stream output user-readable pendant install
- Tests Vitest avec stdin/stdout mock

### Sous-tâche 1c — Intégration dans `apply.ts` (~30min)
- Au tout début de `arc setup --apply` :
  - `checkPrerequisites()` → si OK skip bootstrap
  - Sinon : `promptBootstrap()` puis `installPrerequisites()`
- Re-check post-install, fail-clear si install échoué
- Tests Vitest pour l'intégration

### Sous-tâche 1d — Smoke E2E sur VM fresh (~1h)
- Provision VM Ubuntu 24.04 propre (VMware, Hetzner, Scaleway)
- `curl install-arc | sh && arc setup --apply`
- Mesurer time-to-stack-ready (target < 15 min)
- Documenter timing dans `docs/release-process.md`

### Sous-tâche 1e — Doc + tag stable v0.1.0 (~30min)
- Mise à jour `docs/installation.md` section Prerequisites
- Tag final `v0.1.0` (sans suffix rc/beta)
- Maj `release-process.md` si flow changé

**Total estimé : ~4h cumulées.**

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
