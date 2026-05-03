# ADR-0012 : Single-machine install model (no remote provisioning)

## Statut
Accepté
Date : 2026-05-03
**Supersedes** : ADR-0009 (Dual target local/VPS).

## Contexte

ADR-0009 actait un modèle dual `target: local | vps` :
- En `local`, le CLI tournait sur la machine de l'opérateur via `execa` + Cloudflare Tunnel.
- En `vps`, le CLI sur la machine de l'opérateur ouvrait un SSH (`node-ssh`) vers la cible et provisionnait via Hetzner Cloud API.

Un dual adapter `LocalAdapter` / `VPSAdapter` masquait la différence sous une interface commune `ExecutionAdapter`.

Trois mois après bootstrap, deux constats :

1. **Modèle Coolify (le seul vrai concurrent) est single-machine.** L'utilisateur SSH dans son VPS, lance `curl install.sh | sh` sur place, fini. Aucune notion de "client local pilote un serveur distant". C'est plus simple à comprendre et à déployer.
2. **Le mode dual exigeait un effort disproportionné** : adaptateur SSH, provisioning Hetzner, Cloudflare Tunnel pour exposer le local, gating dans toutes les commandes. ~700 LoC dédiées à un cas d'usage qui ne couvre pas plus de scénarios qu'une install single-machine.

L'utilisateur demande une bascule vers le modèle Coolify : agnostique provider (OVH, Hetzner, Scaleway, AWS, Raspberry Pi…), une seule façon d'installer, zéro provisioning depuis l'extérieur.

## Décision

EuglowLabs ARC adopte un **modèle d'installation single-machine** :

1. L'utilisateur dispose d'une machine cible (VPS chez n'importe quel provider, serveur dédié, Raspberry Pi, machine WSL2 pour test). Il en a un accès root SSH.
2. Il s'y connecte (`ssh root@vps`) et lance **une commande** :
   ```bash
   curl -fsSL https://arc.euglowlabs.com/install.sh | sh
   ```
   Cela télécharge le binaire `arc` et le pose dans `/usr/local/bin/`.
3. Il lance `arc setup`, qui :
   - Pose les questions de config (project, domain, email, dns) interactivement
   - Écrit `~/.arc/arc.config.yml`
   - Exécute le playbook Ansible **en local** (cible `localhost`) pour hardener (UFW, fail2ban, SSH no-password) puis installer Docker + Coolify + `local-ai-packaged`
   - Génère et applique les composes maison (sandbox, agents)
   - Démarre l'ARC Agent
4. Toutes les commandes ultérieures (`arc deploy`, `arc status`, `arc logs`, `arc backup`…) tournent **sur cette même machine**. Pas de SSH distant piloté par le CLI. Pas de provisioning externe.

**L'abstraction `ExecutionAdapter` est conservée**, mais avec une seule implémentation `HostAdapter` (renommée depuis `LocalAdapter`). `MockAdapter` reste pour les tests. Tout l'arsenal `VPSAdapter` / `provisionHetzner` / `arc migrate` / `cloudflared` (CLI mode) est supprimé.

Le schéma `arc.config.yml` cible perd les champs `target`, `provider`, `dns.tunnel`. Il **gagne** un bloc `agent: { bind, port }` pour anticiper la Phase 2 (ARC Agent Go).

## Conséquences

### Bénéfices

+ **Modèle mental aligné sur Coolify** — courbe d'apprentissage nulle pour les utilisateurs venant de Coolify/Dokploy.
+ **Provider-agnostique** — OVH, Hetzner, AWS, Scaleway, RPi : ARC ne sait pas où il tourne. L'utilisateur n'a pas à choisir un provider supporté.
+ **~700 LoC supprimées**, 5 tests retirés, 1 dep (`node-ssh`) en moins. Moins de surface, moins de bugs.
+ **Une seule façon de faire** — fin du gating `if cfg.target === "vps"` éparpillé dans toutes les commandes.
+ **Sécurité simplifiée** — plus de SSH outbound piloté par le CLI, plus d'API token Hetzner stocké côté opérateur. Le hardening UFW/fail2ban tourne en local et reste actif.
+ **Cohérence avec ADR-0003 (ARC Agent en Go)** — l'Agent était déjà conçu pour tourner *sur le VPS*. Le single-machine simplifie son enregistrement (token local, pas de signature Cloud-side en Chantier 1).

### Compromis acceptés (et leurs mitigations documentaires)

- **Plus de `arc migrate` (CLI-023 supprimée).** Le besoin "déplacer mes données d'une machine A vers une machine B" reste valable.
  → **Mitigation obligatoire** : `docs/migration-guide.md` (créé par tâche **DOC-001**) contient un workflow `arc backup` sur A → `scp` manuel → `arc restore` sur B, avec commandes copiables, cas d'usage "changer de VPS" et "dupliquer en staging". **Sans cette doc, la suppression d'`arc migrate` est inacceptable.**

- **Plus de Cloudflare Tunnel CLI (CLI-024 supprimée).** Cas d'usage perdu : utilisateur derrière NAT (RPi à la maison, WSL2 pour test) qui veut exposer ARC sans IP publique.
  → **Mitigation obligatoire** : `docs/migration-guide.md` (ou un `docs/install-without-public-ip.md` dédié, créé par DOC-001) inclut une section "Installer ARC sans IP publique" : procédure manuelle d'install de `cloudflared` côté utilisateur, comment le configurer pour pointer vers les services ARC, ce qu'il remplace fonctionnellement.
  → **À noter** : le tunnel Cloudflare *supprimé* est celui du **CLI mode local**. Le tunnel mentionné dans la spec produit §5.3 pour la **communication ARC Agent ↔ Dashboard** (en cas de VPS NATé) est un usage différent et **reste valide pour Phase 2**. Ne pas confondre les deux.

- **Plus de provisioning Hetzner depuis le CLI.** L'utilisateur doit créer son VPS lui-même chez son provider avant de lancer `install.sh`.
  → **Acceptable** : c'est le standard de l'industrie (Coolify, Dokploy, Plausible self-hosted, Umbrel). L'achat d'un VPS prend 30 secondes chez n'importe quel provider.

- **Page Dashboard `/cross-env` (spec produit §6.3.5) impossible en single-machine.**
  → **Mitigation explicite** : `/cross-env` est **déplacée en Chantier 2 / ARC Cloud**. Le Dashboard self-hosted Niveau 1 n'inclut pas cette page. À acter dans ADR-0013.

- **Pas de multi-VPS au niveau du CLI.** L'utilisateur qui veut prod + staging installe ARC sur deux machines distinctes.
  → **Acceptable** : multi-VPS = problème ARC Cloud (Chantier 2 / spec produit §7). Le CLI reste single-machine pur.

- **Code mort à purger sans pitié** : `vps.ts`, `provision.ts`, `migrate.ts`, `cloudflared.ts`, `provider.ts`. Refactor stage-par-stage encadré par phases C/D du plan refactor (cf. `docs/refactor-0012-inventory.md`).
  → **Mitigation** : procédure rigoureuse en 4 phases avec audit "zéro résidu" (4 greps obligatoires en Phase D).

### Conséquences négatives non mitigeables

- **Provider lock-in inversé** : l'utilisateur peut choisir n'importe quel provider, ARC ne s'engage pas à supporter automatiquement les nouveautés (par exemple, un provider qui exige une CLI propriétaire pour bootstrap). C'est sa responsabilité.

## Migration plan

Détaillé dans `docs/refactor-0012-inventory.md` (Phase A) et exécuté via les tâches Phase 1.5 :

| Tâche | Phase refactor | Livrable |
|---|---|---|
| **REFACTOR-001** | Phase C | Suppression chirurgicale code 🟥 |
| **REFACTOR-002** | Phase D | Refactor 🟧 + renommage `LocalAdapter` → `HostAdapter` |
| **REFACTOR-003** | Phase D | Audit zéro résidu (4 greps) + rapport completion |
| **DOC-001** | Phase D | `docs/migration-guide.md` (mitige P2 + P3) |
| **INSTALL-001** | Post-refactor | Commande `arc setup` all-in-one |
| **ANSIBLE-001** | Post-refactor | Rôles Ansible exécutés en `localhost` |
| **DNS-001** | Post-refactor | Cloudflare DNS records via API (toujours utile) |
| **E2E-001** | Post-refactor | Test bout-en-bout sur VM jetable |

## Alternatives rejetées

- **Garder le dual target.** Trop de code, trop de gating, modèle mental confus, et personne d'autre dans la concurrence directe ne le fait.
- **Single-machine pur sans abstraction `ExecutionAdapter`.** Tester les commandes deviendrait pénible (mocker `child_process`/`fs` partout). Garder `MockAdapter` justifie de garder l'interface.
- **Single-machine + plug-ins pour multi-cloud.** Hors scope Chantier 1 — cf. ADR-0013. ARC Cloud (Chantier 2) couvrira ce besoin.
- **Stocker la config en SQLite (modèle Coolify).** Perd le bénéfice GitOps (commit `arc.config.yml` dans le repo du projet). YAML reste préférable.
