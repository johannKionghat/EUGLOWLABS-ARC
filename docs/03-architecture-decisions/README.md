# Architecture Decision Records (ADR)

Ce dossier trace les **décisions structurantes** du projet EuglowLabs ARC.
Une décision structurante = une décision qui contraint l'architecture, le choix techno, ou les frontières de composants pendant des mois ou des années.

## Quand écrire un ADR

- Choix d'un langage, framework, runtime
- Choix d'une frontière de composant (monorepo vs polyrepo, CLI vs lib)
- Politique de sécurité ou licence
- Pattern transverse (adapter, multi-tenant, isolation réseau)
- Toute décision qu'on n'a pas envie de re-débattre dans 3 mois

## Quand ne pas écrire un ADR

- Choix d'un nom de variable, d'un format de log
- Refacto interne d'un module
- Bug fix
- Détail d'implémentation réversible en 1h

## Format

Chaque ADR est un fichier `NNNN-titre-kebab.md` numéroté.
Si un ADR est superseded, il reste en place et pointe vers le successeur.

## Template

```markdown
# ADR-XXXX : Titre court

## Statut
[Proposé | Accepté | Déprécié | Superseded by ADR-YYYY]
Date : YYYY-MM-DD

## Contexte
Quel problème ? Quelles contraintes ?

## Décision
LA décision, sans détours.

## Conséquences
+ Bénéfices
- Compromis acceptés

## Alternatives rejetées
Pourquoi pas X, Y, Z.
```

## Index

- [ADR-0001 — Monorepo Turborepo](./0001-monorepo-turborepo.md)
- [ADR-0002 — Bun runtime pour le CLI](./0002-bun-runtime-cli.md)
- [ADR-0003 — Go pour ARC Agent](./0003-go-for-arc-agent.md)
- [ADR-0004 — Next.js 15 App Router](./0004-nextjs-15-app-router.md)
- [ADR-0005 — Coolify comme dépendance, jamais forké](./0005-coolify-as-dependency-not-fork.md)
- [ADR-0006 — Apache 2.0 pour les composants OSS](./0006-apache-2-license-oss.md)
- [ADR-0007 — Postgres partagé via Supabase](./0007-postgres-shared-via-supabase.md)
- [ADR-0008 — Trois réseaux Docker isolés](./0008-three-network-isolation.md)
- ⛔ [ADR-0009 — Dual target local/VPS](./0009-dual-target-local-vps.md) *(superseded by ADR-0012)*
- [ADR-0010 — Clerk + Stripe + Supabase pour ARC Cloud](./0010-clerk-stripe-supabase-cloud.md)
- [ADR-0011 — Critères d'acceptation end-to-end (28 critères)](./0011-end-to-end-install-acceptance.md)
- [ADR-0012 — Single-machine install model](./0012-single-machine-install.md)
- [ADR-0013 — Strict Chantier 1 / Chantier 2 separation](./0013-chantier-1-2-separation.md)
- [ADR-0014 — Persona cible de la documentation utilisateur](./0014-doc-target-persona.md)
- [ADR-0015 — Layout des artefacts utilisateur sous `~/.arc/`](./0015-layout-arc-user-artifacts.md)
- [ADR-0016 — Distribution & packaging strategy](./0016-distribution-strategy.md)
