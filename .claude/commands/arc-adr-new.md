---
description: Crée un nouvel ADR (Architecture Decision Record) après réflexion structurée et validation utilisateur
argument-hint: [titre-court-de-la-decision]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Créer un nouvel ADR pour EuglowLabs ARC

Tu vas créer un ADR proprement après avoir compris le contexte, exploré les alternatives, et validé la décision avec l'utilisateur.

## Inputs

- `$1` = titre court de la décision en kebab-case (ex: `redis-for-cache`, `prefer-drizzle-over-prisma`)
- Si vide, demande à l'utilisateur de fournir un titre

## Phase 0 — Pré-vérifications

1. Lis `CLAUDE.md`
2. Liste tous les ADRs existants : `ls docs/03-architecture-decisions/*.md | sort`
3. Lis le `README.md` du dossier ADR (template)
4. Identifie le **prochain numéro** d'ADR (ADR le plus haut + 1, format `0011`, `0012`, ...)

## Phase 1 — Compréhension de la décision

Pose à l'utilisateur **3 à 5 questions précises** pour cadrer la décision. Adapte selon le titre.

Exemple générique :

> Avant d'écrire l'ADR, j'ai besoin de cerner précisément la décision.
>
> 1. **Problème** : quel problème concret est-ce que cette décision résout ? (1-3 phrases)
> 2. **Contraintes** : quelles contraintes existent ? (perf, coût, compétences, écosystème)
> 3. **Alternatives** : à part la solution que tu envisages, quelles autres options as-tu envisagées ?
> 4. **Compromis** : qu'es-tu prêt à céder pour adopter cette décision ?
> 5. **Réversibilité** : est-ce une décision facilement réversible ou structurante ?

**Attends les réponses de l'utilisateur avant de continuer.**

## Phase 2 — Détection de conflits avec ADRs existants

Une fois les réponses obtenues :

1. Parcours les ADRs existants (lis leur titre + section "Décision")
2. Identifie d'éventuels conflits ou tensions :
   - Nouvelle décision contredit une ancienne → ANCIEN à marquer "Superseded by ADR-XXXX"
   - Nouvelle décision étend ou nuance une ancienne → mentionner explicitement
   - Nouvelle décision concerne un domaine déjà couvert → questionner si vraiment nouveau

3. Si conflit détecté :
   - Affiche les ADRs concernés
   - Demande à l'utilisateur de clarifier (la nouvelle remplace ? coexiste ? affine ?)
   - Attends la décision avant de continuer

## Phase 3 — Vérification cohérence specs

Cherche dans `docs/01-spec-infra.md` et `docs/02-spec-arc-product.md` :
- Le sujet de l'ADR est-il déjà tranché dans une spec ?
- Si oui, l'ADR doit refléter la spec, pas la contredire
- Si l'ADR contredit la spec : ARRÊTE et propose à l'utilisateur soit de revenir sur la spec (en l'éditant), soit de revoir la décision

## Phase 4 — Rédaction de l'ADR

Crée le fichier `docs/03-architecture-decisions/{NUM}-{titre-kebab}.md` avec ce format strict :

```markdown
# ADR-{NUM} : {Titre lisible}

## Statut
Proposé — YYYY-MM-DD

## Contexte
{2-5 phrases sur le problème, les contraintes, le moment où ça s'est posé}
{Mentionne le contexte projet EuglowLabs ARC : quel composant est concerné — CLI, Agent, Dashboard, Cloud, Sentinel, Marketplace}

## Décision
{LA décision en 1-3 phrases. Direct, sans détours.}

## Conséquences

### Positives
+ {Bénéfice 1}
+ {Bénéfice 2}
+ {Bénéfice 3}

### Négatives / compromis
- {Compromis 1}
- {Compromis 2}

### Mitigations
- {Comment on compense les compromis}

## Alternatives rejetées

### {Alternative 1}
{Pourquoi rejetée en 1-2 phrases}

### {Alternative 2}
{Pourquoi rejetée en 1-2 phrases}

## Références
- Spec : {lien vers section précise des specs si pertinent}
- ADRs liés : ADR-XXXX, ADR-YYYY
- Discussion : {lien GitHub issue, Discord, etc. si applicable}
```

Règles de rédaction :
- **30 à 60 lignes** total. Pas plus, pas moins.
- Aucune section vide. Si tu n'as pas de contenu pour une section, c'est que la décision n'est pas mûre — retourne en Phase 1.
- Statut **toujours "Proposé"** à la création. L'utilisateur le passera en "Accepté" lui-même après réflexion finale.
- Pas de jargon inutile. L'ADR doit être lisible par un dev junior dans 6 mois.

## Phase 5 — Détection des superseded ADRs

Si en Phase 2 tu as identifié un ancien ADR rendu obsolète :

1. Modifie l'ancien ADR pour changer son statut :
```
   ## Statut
   Superseded by ADR-{NOUVEAU_NUM} — YYYY-MM-DD
```
2. Garde tout le reste de l'ancien ADR intact (historique précieux)

## Phase 6 — Mise à jour du CLAUDE.md si nécessaire

Si la nouvelle décision affecte la "Stack figée" mentionnée dans `CLAUDE.md` :

1. Signale-le à l'utilisateur
2. Propose un patch précis du CLAUDE.md (avant/après)
3. **Attends validation** avant d'appliquer

## Phase 7 — Mise à jour du scratchpad de la tâche en cours (si applicable)

Si `tasks/current.md` contient une tâche active et que cet ADR a été créé pendant cette tâche :

1. Ajoute dans la section "ADRs liés" de `tasks/current.md` la référence au nouvel ADR
2. Note dans le "Scratchpad" de la tâche : "Nouvel ADR créé : ADR-{NUM} — {titre}"

## Phase 8 — Résumé final

Affiche à l'utilisateur :

```
✅ ADR-{NUM} créé en statut "Proposé"

Fichier : docs/03-architecture-decisions/{NUM}-{titre}.md
Lignes : {nombre}

ADRs supersedés : {liste ou "aucun"}
CLAUDE.md modifié : {oui/non}
Tâche en cours mise à jour : {oui/non}

Prochaines étapes :
1. Relis l'ADR et ajuste si nécessaire
2. Quand tu valides, change "Proposé" en "Accepté" dans le fichier
3. Optionnel : commit `docs(adr): add ADR-{NUM} {titre} [skip ci]`
```

## Règles ABSOLUES

- Tu ne crées JAMAIS un ADR sans avoir posé les 3-5 questions de Phase 1
- Tu ne marques JAMAIS un ADR comme "Accepté" toi-même — c'est toujours l'utilisateur qui décide
- Si la décision te semble triviale (style de code, naming) : ce n'est probablement PAS un ADR. Suggère plutôt d'éditer `docs/04-conventions/`
- Si la décision te semble énorme (refonte complète) : décompose-la en plusieurs ADRs plus petits
- Tu ne crées PAS de code applicatif depuis ce slash command
- Le projet s'appelle **EuglowLabs ARC**. Le binary CLI s'appelle `arc`. Le monorepo s'appelle `euglowlabs-arc`.