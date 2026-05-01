# ADR-0010 : Clerk + Stripe + Supabase managed pour ARC Cloud

## Statut
Accepté
Date : 2026-05-01

## Contexte
ARC Cloud est le backend SaaS multi-tenant payant (cf. spec produit §7). Il gère :
- Auth utilisateurs (login, OAuth GitHub/Google, MFA admin)
- Organisations + memberships + permissions
- Billing récurrent (plans Pro/Team/Business) + revenue share marketplace
- Stockage durable (orgs, VPS enregistrés, métriques agrégées, templates)

Le fondateur est solo. La fenêtre **time-to-market vs build-everything** est critique. Auto-héberger ARC Cloud sur ARC self-hosted dès le day 1 = ironie marketing séduisante mais multiplie les sources de panne au lancement.

## Décision
**ARC Cloud utilise des services managés au lancement** :

| Service | Choix | Rôle |
|---|---|---|
| Auth | **Clerk** | Sessions, OAuth, MFA, orgs natives |
| Billing | **Stripe** | Abonnements, Stripe Connect (revenue share marketplace) |
| Postgres | **Supabase managed** | DB SaaS multi-tenant (schéma par org) |
| Email | **Resend** | Transactionnel + marketing |
| Storage | **Cloudflare R2** | Templates marketplace, assets |
| Hosting | **Vercel** | Next.js 15 SaaS |
| Queue | **Inngest** (préféré) ou BullMQ | Jobs (deploy webhooks, billing events) |

Auto-hébergement d'ARC Cloud sur EuglowLabs ARC self-hosted = **cas d'étude marketing futur** (cf. spec produit §16.1), pas day-one. Migration prévue une fois la traction validée et le produit stabilisé.

## Conséquences
+ Time-to-market réduit de plusieurs mois (auth + billing = sujets piégeux à implémenter from scratch)
+ Fiabilité plus haute au lancement (Clerk/Stripe SLA > self-host solo)
+ Focus founder reste sur le produit (CLI, Agent, Dashboard, Sentinel)
+ Migration future = **excellent contenu de blog post / case study** ("on a migré notre SaaS ARC Cloud sur ARC self-hosted en X jours")
- Coûts variables : Clerk ~25 $/mois en pro tier, Stripe fees, Supabase ~25 $/mois — assumés (cf. spec §13.4)
- Lock-in modéré sur Clerk (auth) → mitigation : abstraire derrière une interface `AuthProvider` côté app

## Alternatives rejetées
- **Auto-héberger Supabase + Lucia/Auth.js + custom billing** dès le day 1 — coût ingénierie 2-3 mois en plus, fiabilité moindre
- **Supabase Auth managed** au lieu de Clerk — moins fluide pour les organisations multi-tenant en 2026 ; Clerk a une UX orgs supérieure
- **Paddle au lieu de Stripe** — pertinent pour TVA simplifiée mais moins de flexibilité revenue share marketplace
