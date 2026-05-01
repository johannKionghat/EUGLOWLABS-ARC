---
description: Démarre une tâche depuis tasks/INDEX.md ou tasks/backlog/, l'active dans tasks/current.md, et propose un plan d'implémentation
argument-hint: [task-id]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Démarrer une tâche EuglowLabs ARC

Tu vas activer une tâche du backlog et proposer un plan d'implémentation **avant** de toucher au code.

## Inputs

- `$1` = ID de la tâche (ex: `INFRA-001`, `CLI-042`, `DASH-007`).
- Si `$1` est vide : liste les 5 prochaines tâches non commencées dans `tasks/INDEX.md` et demande à l'utilisateur de choisir.

## Phase 0 — Pré-vérifications

1. Vérifie qu'on est à la racine d'un repo git
2. Vérifie que `CLAUDE.md` existe → sinon ARRÊTE et dis à l'utilisateur de lancer `/arc-bootstrap` d'abord
3. Lis `CLAUDE.md` en entier
4. Lis `tasks/INDEX.md`
5. Lis `tasks/current.md`

## Phase 1 — Vérification de l'état actuel

**Si `tasks/current.md` contient déjà une tâche en cours et qu'elle n'est PAS marquée terminée :**

- Affiche le contenu de la tâche en cours
- Demande à l'utilisateur :
  - **(a)** Continuer la tâche en cours (j'arrête, tu reprends manuellement)
  - **(b)** Archiver la tâche en cours comme abandonnée (`tasks/completed/ABANDONED-{id}-{date}.md`) puis démarrer la nouvelle
  - **(c)** Marquer la tâche en cours comme terminée et lancer `/arc-task-complete` à la place

NE BASCULE JAMAIS automatiquement. L'utilisateur tranche.

## Phase 2 — Récupération de la tâche

1. Cherche la tâche `$1` dans `tasks/INDEX.md` :
   - Si elle est marquée ✅ Terminée : ARRÊTE, dis-le à l'utilisateur
   - Si elle est marquée 🟡 En cours : ARRÊTE, dis-le
   - Si elle n'existe pas : cherche dans `tasks/backlog/{$1}.md`
   - Si elle n'existe nulle part : ARRÊTE, propose de la créer manuellement

2. Si elle est dans `backlog/`, lis-la entièrement
3. Si elle est seulement listée dans `INDEX.md` (sans fichier détaillé) :
   - Lis la spec produit (`docs/02-spec-arc-product.md`) ET la spec infra (`docs/01-spec-infra.md`) pour reconstruire le détail
   - Génère un fichier de tâche structuré (voir format ci-dessous) à partir du libellé court de l'INDEX

## Phase 3 — Lecture du contexte pertinent

Identifie quels documents sont nécessaires pour cette tâche :

- **TOUJOURS** : `CLAUDE.md` (déjà lu), conventions liées à la tâche
- **Selon le scope** :
  - Tâche `INFRA-*` → `docs/04-conventions/git-workflow.md`, `coding-style.md`
  - Tâche `CLI-*` → ADR-0002 (Bun), ADR-0001 (monorepo)
  - Tâche `AGENT-*` → ADR-0003 (Go), ADR-0008 (réseaux)
  - Tâche `DASH-*` → ADR-0004 (Next.js), `coding-style.md`
  - Tâche `CLOUD-*` → ADR-0010 (Clerk/Stripe/Supabase)
  - Tâche `LLM-*` ou `SENTINEL-*` → spec produit §9
  - Tâche touchant Coolify → ADR-0005 (jamais forker)

Lis tous ces documents.

## Phase 4 — Activation de la tâche

1. Si la tâche existait dans `backlog/`, déplace-la vers `current.md` (mv)
2. Sinon, écris `tasks/current.md` avec ce format strict :

Tâche en cours : [TASK-ID] — [Titre]Statut
🟡 En cours — démarrée le YYYY-MM-DD HH:MMObjectif
[1-3 phrases : ce qu'on veut accomplir et pourquoi]Critères d'acceptation

 Critère 1 vérifiable (ex: tests verts)
 Critère 2 vérifiable
 ...
Fichiers concernés (estimation)

chemin/fichier1.ts (création)
chemin/fichier2.ts (modification)
...
ADRs liés

ADR-XXXX : [titre]
Conventions à respecter

coding-style.md sections X, Y
testing.md
Hors scope (NE PAS faire)

[chose tentante mais à reporter]
[autre chose à éviter]
Plan d'implémentation
[À remplir en Phase 5 ci-dessous]Scratchpad
[Claude met à jour pendant le travail — décisions, blockers, questions]

3. Met à jour `tasks/INDEX.md` : passe la tâche en `🟡 En cours`

## Phase 5 — Proposition d'un plan AVANT de coder

C'est la partie la plus importante. **Tu ne dois ABSOLUMENT PAS coder maintenant.**

Propose un plan d'implémentation en sous-tâches dans la section "Plan d'implémentation" de `tasks/current.md` :

Plan d'implémentationSous-tâche 1 : [titre court]

Fichiers : [...]
Effort estimé : [X min]
Détail : [2-4 phrases]
Sous-tâche 2 : ...

Règles pour le plan :
- **3 à 7 sous-tâches**, pas plus
- Chaque sous-tâche < 30 min de travail
- Chaque sous-tâche a un livrable concret (un fichier, un test qui passe, etc.)
- L'ordre est logique (déps avant utilisateurs, types avant logique, logique avant tests si TDD-light)
- Si tu identifies une décision structurante non couverte par les ADRs : NE LA PRENDS PAS, mentionne-la et propose à l'utilisateur de lancer `/arc-adr-new` avant de continuer

## Phase 6 — Demande de validation

Après avoir écrit le plan dans `tasks/current.md`, affiche dans la conversation :

1. Le titre de la tâche
2. L'objectif en 1 phrase
3. La liste des sous-tâches (titre seulement, pas le détail)
4. Les ADRs et conventions chargés
5. Les questions ouvertes éventuelles

Termine par :

> ✋ **Avant que je code quoi que ce soit, valide ce plan.**
> - Tape **"go"** pour que je commence par la sous-tâche 1
> - Tape **"go N"** pour démarrer à la sous-tâche N
> - Donne-moi tes ajustements sinon

**Tu attends la réponse. Tu ne codes pas.**

## Règles ABSOLUES

- Tu n'écris AUCUNE ligne de code applicatif dans ce slash command
- Tu ne fais PAS `git commit` ni `pnpm install`
- Si la tâche te semble trop grosse (> 2h estimées), STOPPE et propose à l'utilisateur de la découper
- Si tu détectes une dépendance non triviale vers une autre tâche (ex: tâche actuelle nécessite qu'on ait fini X avant), STOPPE et signale-le
- Le projet s'appelle **EuglowLabs ARC**. Le binary CLI s'appelle `arc`. Le monorepo s'appelle `euglowlabs-arc`. Ne dérive jamais.

```markdown