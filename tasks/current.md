# CLI-031 — Embed compose templates (.eta) in the compiled binary

**Priorité : HIGH — bloque tag stable v0.1.0 et complétion du smoke E2E.**
**Statut : 🟡 En cours — démarrée le 2026-05-14.**

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

## Plan d'implémentation

Audit du code existant (effectué 2026-05-14) :

- **Point d'injection UNIQUE identifié** : `packages/arc-cli/src/templates/render.ts:21`
  ```ts
  const source = readFileSync(path, "utf8");
  return eta.renderString(source, data);
  ```
  Refactor une seule fonction (`renderTemplate`) — pas besoin de toucher
  les 4 consumers (`prod-compose.ts`, `sandbox-compose.ts`,
  `agents-compose.ts`, `env.ts`) qui appellent tous `renderTemplate(name, data)`.

- **4 templates source** dans `packages/arc-cli/src/templates/__templates__/` :
  - `env.eta`
  - `docker-compose.prod.yml.eta`
  - `docker-compose.sandbox.yml.eta`
  - `docker-compose.agents.yml.eta`

- **Référence pattern** : `scripts/generate-playbooks-manifest.mjs` (DIST-001 1a-2)
  scanne `packages/arc-cli/playbooks/**`, génère `playbooks-manifest.ts` avec
  `Record<relPath, content>` inline JSON-stringifié. Pre-hooks
  `pretypecheck`/`pretest`/`prebuild` regenerent automatiquement.

### Sous-tâche 1a — Script codegen + manifest généré (~25 min)

- **Création** :
  - `scripts/generate-templates-manifest.mjs` (~30 lignes)
    - Scanne `packages/arc-cli/src/templates/__templates__/*.eta`
    - Output : `packages/arc-cli/src/templates-manifest.ts`
    - Structure : `export const TEMPLATES_MANIFEST: Readonly<Record<string, string>> = { ... }`
      Clés = basename du `.eta`. Valeurs = contenu JSON.stringify.
    - Log final : `✓ Wrote ${outFile} (${count} templates)`
    - ESM `.mjs` Node 20+ pur, console.info (cohérent gen-install-page.mjs et gen-playbooks-manifest.mjs)
- **Modifications** :
  - `packages/arc-cli/.gitignore` : ajout ligne `src/templates-manifest.ts`
  - `biome.json` : ajout `"packages/arc-cli/src/templates-manifest.ts"` dans ignore (mêmes patterns que playbooks-manifest)
- **Livrable** : 1 nouveau script + 2 fichiers infrastructure modifiés.
  Exécuter `node scripts/generate-templates-manifest.mjs` produit
  `templates-manifest.ts` (gitignored).

### Sous-tâche 1b — Refactor `render.ts` pour consommer le manifest (~20 min)

- **Modification** : `packages/arc-cli/src/templates/render.ts`
  - Remove imports `readFileSync`, `dirname`, `resolve`, `fileURLToPath`
  - Remove `here`, `templatesDir`, `views: templatesDir` (plus de FS read)
  - Add `import { TEMPLATES_MANIFEST } from "../templates-manifest.js"`
  - `renderTemplate(name, data)` : lire `TEMPLATES_MANIFEST[name]` au lieu de `readFileSync`
  - Si template manquant → throw `Error("template not found in manifest: ${name}")` (au lieu d'un ENOENT cryptique)
- **Eta config** : retirer `views` (plus pertinent — pas de FS lookup), garder `autoEscape: false`
- **Tests existants** : `prod-compose.test.ts`, `sandbox-compose.test.ts`, `agents-compose.test.ts`, `env.test.ts` doivent tous passer sans modif (ils testent le rendu via `generate*Compose(cfg)` qui appelle `renderTemplate`)
- **Livrable** : 1 fichier modifié, tests existants verts.

### Sous-tâche 1c — Pre-hooks régénération auto (~15 min)

- **Modification** : `packages/arc-cli/package.json`
  - Ajout script : `"gen:templates-manifest": "node ../../scripts/generate-templates-manifest.mjs"`
  - Étendre pre-hooks existants pour générer LES 2 manifests :
    ```
    "pretypecheck": "pnpm gen:manifest && pnpm gen:templates-manifest",
    "pretest": "pnpm gen:manifest && pnpm gen:templates-manifest",
    "prebuild": "pnpm gen:manifest && pnpm gen:templates-manifest"
    ```
- **Validation locale** :
  - `rm -f packages/arc-cli/src/templates-manifest.ts` (supprime manifest)
  - `pnpm test` → manifest régénéré automatiquement, tests passent
- **Livrable** : 1 fichier modifié, workflow régénération auto validé.

### Sous-tâche 1d — Smoke E2E sur VM utilisateur (~30 min interactif)

- **Côté repo** :
  - Bump `arc-cli/package.json` 0.1.0-rc.3 → 0.1.0-rc.4
  - Commit `chore(release): bump arc-cli to 0.1.0-rc.4 for CLI-031 1d smoke [CLI-031]`
  - Tag `v0.1.0-rc.4` + push → CI publish.yml déclenche (~10 min)
- **Côté VM utilisateur** (après CI verte) :
  - `curl -fsSL https://install-arc.euglowlabs.com | ARC_VERSION=0.1.0-rc.4 sh`
  - `arc version` → confirmer `0.1.0-rc.4 (sha=...)`
  - `arc setup --apply` → ré-utiliser config existante (ansible déjà installé via CLI-029)
  - Confirmer : Step 5 compose generation PASSE sans ENOENT, Step 7 lance `ansible-playbook` (au moins première ligne du déroulé)
  - Si playbook échoue plus tard (Docker, Cloudflare DNS, etc.) → hors scope CLI-031
- **Livrable** : output utilisateur cité dans scratchpad, smoke partiel validé.

### Sous-tâche 1e — Doc + tag v0.1.0 stable (~25 min)

- **Bump** : `arc-cli/package.json` 0.1.0-rc.4 → 0.1.0 (sans suffix)
- **Commit** : `chore(release): bump arc-cli to 0.1.0 stable [CLI-031]`
- **Tag** : `git tag -a v0.1.0 -m "ARC CLI 0.1.0 stable — CLI-029 + CLI-031"`
- **Push** : `git push origin main && git push origin v0.1.0`
- **CI** : publish.yml détecte tag SANS `-rc/-beta/-alpha` → release **non-prerelease** → "Latest" pointer bouge sur v0.1.0
- **Maj `docs/installation.md`** si nécessaire : section Prerequisites simplifiée si pertinent
- **Maj `docs/release-process.md`** : noter que CLI-031 a complété le pipeline self-driving
- **Livrable** : tag stable v0.1.0 en prod, accessible publiquement via
  `curl install-arc.euglowlabs.com | sh` SANS pin `ARC_VERSION`.

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

## Scratchpad

### 2026-05-14 — 1a + 1b livrées

- **1a ✅** (commit `4770aa7`) : `scripts/generate-templates-manifest.mjs`
  + `.gitignore` + `biome.json` ignore. 4 templates manifested
  (env.eta + docker-compose.{prod,sandbox,agents}.yml.eta). Pattern
  identique DIST-001 1a-2 playbooks-manifest.
- **1b ✅** (commit en cours) : refactor
  `packages/arc-cli/src/templates/render.ts` pour consommer
  `TEMPLATES_MANIFEST` au lieu de `readFileSync`. Signature
  `renderTemplate(name, data)` préservée → 4 tests
  templates/*.test.ts passent sans modif. Throw explicite si template
  manquant (au lieu d'ENOENT cryptique).
- **Next : 1c** — étendre les pre-hooks `pretypecheck`/`pretest`/`prebuild`
  dans `packages/arc-cli/package.json` pour exécuter automatiquement
  `pnpm gen:templates-manifest` en plus de `gen:manifest` (playbooks).
