# CLI-031 — Embed compose templates (.eta) in the compiled binary

**Priorité : HIGH — bloque tag stable v0.1.0 et complétion du smoke E2E.**
**Statut : backlog post-CLI-029.**

## Contexte

CLI-029 (auto-bootstrap Ansible via apt + @clack prompt) a été livré et
validé in-vivo sur VMware Ubuntu 24.04 le 2026-05-13 :

```
◇  Installer Ansible automatiquement ?
│  Yes
Reading package lists...
[... 16 packages installed ...]
Setting up ansible (13.1.0+dfsg-1ubuntu1)…
└  ✗ Compose generation failed: ENOENT: no such file or directory,
   open '/$bunfs/root/__templates__/docker-compose.prod.yml.eta'
```

Le bootstrap CLI-029 a réussi — Ansible installé proprement. **Mais
l'étape suivante d'`applyStack` (Step 5 — compose generation) plante**
avec un ENOENT sur un template `.eta` (Eta templating engine).

## Root cause

Les templates Eta (`docker-compose.prod.yml.eta`,
`docker-compose.sandbox.yml.eta`, `docker-compose.agents.yml.eta`)
résident dans `packages/arc-cli/src/templates/` (ou un sous-dossier).
En **dev** (via `pnpm tsx` ou `vitest`), ils se lisent depuis le
filesystem normal → OK.

Dans le **binaire compilé Bun** (`bun build --compile`), les templates
ne sont **pas embarqués** par défaut. Le path résolu devient
`/$bunfs/root/__templates__/...` qui n'existe pas dans le système de
fichiers virtuel du binaire → ENOENT au runtime.

C'est exactement le même type de bug que DIST-001 1a-2 a résolu pour
les **playbooks Ansible** (via codegen → `playbooks-manifest.ts` avec
contenus inline JSON-stringifiés + `EmbeddedPlaybooksLoader`). Le
pattern n'a pas été appliqué aux **templates Eta** au moment où ils
ont été introduits.

Bug **pré-CLI-029 / pré-DIST-001**, jamais détecté car personne n'avait
jamais exécuté le binaire compilé jusqu'à `Step 5` d'`applyStack` (la
plupart des tests `arc setup --apply` antérieurs se sont arrêtés au
détection d'Ansible absent — ce que CLI-029 résout).

## Objectif

Le binaire compilé `arc` doit pouvoir générer les 3 composes
(`prod`, `sandbox`, `agents`) sans aucun accès au filesystem hôte pour
les templates. Les templates `.eta` sont embarqués au compile time
dans un manifest, consommés à runtime par les `generate*Compose` du
package `templates/`.

## Cible utilisateur

Utilisateur final qui vient de finir CLI-029 1d smoke. Sur sa VM
Ubuntu 24.04 vierge :

```bash
curl install-arc.euglowlabs.com | sh  # binaire installé
arc setup --apply                      # prompt CLI-029 → Yes
                                        # apt install ansible OK
                                        # → composes générés sans erreur
                                        # → Ansible playbook lancé
                                        # → stack opérationnelle
```

## Critères d'acceptance

- [ ] `arc setup --apply` via binaire compilé génère les 3 composes
      (`docker-compose.{prod,sandbox,agents}.yml`) dans `~/.arc/compose/`
      sans erreur ENOENT
- [ ] Les composes générés sont fonctionnellement identiques à ceux
      générés en dev (`pnpm tsx src/index.ts setup --apply`)
- [ ] Codegen idempotent : `pnpm gen:templates-manifest` peut être
      relancé sans diff, regénère si templates Eta source changent
- [ ] Pre-hooks `pretypecheck` / `pretest` / `prebuild` régénèrent le
      manifest automatiquement (cohérent DIST-001 1a-2 playbooks)
- [ ] `templates-manifest.ts` gitignored (pattern playbooks)
- [ ] Tests Vitest unitaires sur la lecture du manifest
- [ ] Smoke E2E sur ta VM VMware : `arc setup --apply` complet jusqu'à
      `ansible-playbook` (au moins jusqu'à la première ligne du déroulé,
      pas besoin de finir le playbook entier)

## Plan d'implémentation (estimation)

### Sous-tâche 1a — Audit templates + script codegen (~30 min)

- Localiser les fichiers `.eta` source dans `packages/arc-cli/`
- Créer `scripts/generate-templates-manifest.mjs` :
  - Scanne le dossier des templates `.eta`
  - Génère `packages/arc-cli/src/templates-manifest.ts` avec
    `Record<filename, content>` (inline JSON.stringify, pattern
    playbooks-manifest.ts)
  - Logue : "✓ Wrote templates-manifest.ts (N templates)"
- Ajouter à `.gitignore` : `packages/arc-cli/src/templates-manifest.ts`
- Ajouter à `biome.json` ignore (cohérent playbooks-manifest)

### Sous-tâche 1b — Consommer le manifest dans templates/*.ts (~25 min)

- Refactor `packages/arc-cli/src/templates/prod-compose.ts` (et
  sandbox/agents) pour lire le template depuis le manifest au lieu du
  filesystem
- Adapter les Eta render calls (Eta accepte une string en input)
- Tests Vitest existants doivent passer sans modif (les
  `templates/*.test.ts` doivent tester le rendu, pas la source)

### Sous-tâche 1c — Pre-hooks régénération (~15 min)

- Ajouter `gen:templates-manifest` dans `packages/arc-cli/package.json`
  scripts
- Étendre les pre-hooks `pretypecheck`, `pretest`, `prebuild` pour
  exécuter `pnpm gen:manifest && pnpm gen:templates-manifest`
- Tester en local : suppression du manifest puis `pnpm build` → manifest
  régénéré automatiquement

### Sous-tâche 1d — Smoke E2E sur VM utilisateur (~25 min interactif)

- Bump `arc-cli/package.json` 0.1.0-rc.3 → 0.1.0-rc.4
- Tag `v0.1.0-rc.4` → CI publish.yml → release prerelease
- Utilisateur : `curl install-arc.euglowlabs.com | ARC_VERSION=0.1.0-rc.4 sh`
- `arc setup --apply` → confirmer que les composes se génèrent puis que
  `ansible-playbook` démarre (au moins première ligne)
- Si le playbook échoue plus tard (étape Docker install, Cloudflare DNS,
  etc.), c'est hors scope CLI-031 → autres tickets

### Sous-tâche 1e — Doc + tag v0.1.0 stable (~25 min)

- Bump `arc-cli/package.json` 0.1.0-rc.4 → 0.1.0
- Tag `v0.1.0` stable (sans suffixe rc)
- CI publie release publique sans prerelease flag → "Latest" pointer
  bouge sur v0.1.0
- Mise à jour `docs/installation.md` si nécessaire
- Documenter dans `docs/release-process.md` que CLI-031 a complété le
  pipeline self-driving

**Total estimé : ~2h cumulées sur 5 sous-tâches.**

## Fichiers concernés (estimation)

### Création
- `scripts/generate-templates-manifest.mjs`
- `packages/arc-cli/src/templates-manifest.ts` (NEW gitignored, codegen output)

### Modification
- `packages/arc-cli/src/templates/prod-compose.ts` (lecture manifest)
- `packages/arc-cli/src/templates/sandbox-compose.ts` (idem)
- `packages/arc-cli/src/templates/agents-compose.ts` (idem)
- `packages/arc-cli/package.json` (scripts + pre-hooks)
- `.gitignore` (ajout du manifest)
- `biome.json` (ignore du manifest, comme playbooks)

## ADRs liés

- **ADR-0002** — Bun CLI runtime + `bun build --compile`. Le manifest
  pattern est conforme — pas de nouveau ADR nécessaire.
- **ADR-0011** — A3 satisfaction (continuité après CLI-029).

## Hors scope (NE PAS faire)

- ❌ Refactor des `templates/*.ts` API publique. On garde les
  signatures `generateProdCompose(cfg)` / etc. inchangées.
- ❌ Changement du moteur Eta vers autre chose (Handlebars/Mustache).
- ❌ Embed des playbooks dans le même manifest que les templates.
  Garder les 2 séparés (cohérence : `playbooks-manifest.ts` pour
  Ansible, `templates-manifest.ts` pour composes).
- ❌ Smoke des étapes post-compose (Docker install, Cloudflare DNS,
  ai-stack démarrage). Ces étapes peuvent échouer en local — c'est
  une fonction de la stack ARC en général, pas du fix CLI-031.

## Bloque

- 🔴 **Tag stable `v0.1.0`** — sans CLI-031 livré, `arc setup --apply`
  plante après l'install d'Ansible → bad first impression pour les
  end-users sans pin ARC_VERSION. Même justification que CLI-029 a
  bloqué v0.1.0 jusqu'à présent.
- Validation finale du pipeline self-driving ADR-0011 A3 end-to-end.

## Pas bloqué par

- CLI-029 ✅ (auto-bootstrap système) — déjà livré et validé in-vivo.
- DIST-001 ✅ (distribution & packaging) — déjà livré.
- LOCAL-001 (mode WSL) — orthogonal.

## Notes opérationnelles

- Le pattern de codegen est éprouvé via DIST-001 1a-2 (playbooks). Ré-
  appliquer le même mécanisme aux templates est mécanique, peu risqué.
- Attention à la sérialisation : les templates `.eta` contiennent
  des caractères spéciaux (`<%`, `%>`, etc.) qui sont déjà gérés par
  `JSON.stringify` (pattern playbooks). Pas de quoting custom à
  inventer.
- Lefthook hook `commit-msg` n'a pas besoin de modifications.
- Le manifest sera embarqué via `bun build --compile` exactement comme
  `playbooks-manifest.ts` — pas de config Bun particulière requise
  (les fichiers `.ts` du package sont naturellement bundlés).
