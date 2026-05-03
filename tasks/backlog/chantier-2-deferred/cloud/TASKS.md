# Cloud — backend SaaS multi-tenant pur — Chantier 2 deferred 🧊

> ⛔ Gelé par ADR-0013. Voir `../README.md`.
> Ce dossier ne contient **que** le backend Cloud (auth, billing, schémas multi-org, endpoints API, isolation multi-tenant). Les pages Dashboard liées (Niveau 3) sont dans `../dashboard-l2-l3/TASKS.md`.

| ID | Titre | Source |
|---|---|---|
| CLOUD-001 | Bootstrap Next.js 15 + Drizzle + Postgres (Supabase managed) | INDEX initial |
| CLOUD-002 | Schéma Drizzle : User, Org, Membership, VPS, Project, ApiKey | INDEX initial |
| CLOUD-003 | Migrations Drizzle + seed dev | INDEX initial |
| CLOUD-004 | Intégration Clerk (signup, login, OAuth GitHub/Google) | INDEX initial |
| CLOUD-005 | Création d'org au signup + invitations membres | INDEX initial |
| CLOUD-006 | Permissions RBAC (owner/admin/member/viewer) middleware | INDEX initial |
| CLOUD-007 | Endpoint `POST /v1/vps/register` consommé par `arc cloud connect` | INDEX initial |
| CLOUD-008 | Génération + rotation token VPS pour ARC Agent | INDEX initial |
| CLOUD-009 | Intégration Stripe : produits Hobby/Pro/Team/Business | INDEX initial |
| CLOUD-010 | Webhooks Stripe : subscription created/updated/canceled | INDEX initial |
| CLOUD-013 | Connexion Dashboard self-host ↔ ARC Cloud (via API key) | INDEX initial |
| CLOUD-014 | Lancement waitlist beta + emails Resend transactionnels | INDEX initial |

> Les pages **Dashboard `/billing`** (ex-CLOUD-011) et **`/team`** (ex-CLOUD-012) ont été déplacées vers `../dashboard-l2-l3/TASKS.md` car ce sont des pages UI (Niveau 3), pas du backend SaaS. Elles dépendent fonctionnellement du backend Cloud — l'ordre d'implémentation reste : backend Cloud (cloud/) **puis** pages (dashboard-l2-l3/).
