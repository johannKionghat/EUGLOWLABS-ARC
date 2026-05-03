# Chantier 2 — DEFERRED 🧊

> ⛔ **Tâches gelées par [ADR-0013](../../../docs/03-architecture-decisions/0013-chantier-1-2-separation.md). NE PAS DÉMARRER.**

## Pourquoi

ARC est découpé en deux chantiers strictement séquentiels. Tant que **Chantier 1** (CLI + Stack déployée + Dashboard Niveau 1 + ARC Agent + migration des 4 projets + 7j dogfood) n'est pas validé par l'utilisateur via le message exact `"go chantier 2"`, **aucune** des tâches listées ici ne peut être commencée.

La règle est encodée dans `CLAUDE.md` comme règle non-négociable : tout agent (humain ou LLM) qui démarre une tâche d'ici doit être arrêté.

## Comment passer Chantier 1 → 2

Voir `tasks/CHANTIER-1-VALIDATION.md` pour les 5 critères. Ils doivent être tous cochés ET l'utilisateur doit envoyer le message exact `"go chantier 2"` dans la conversation.

## Organisation

Les tâches Chantier 2 sont rangées par sous-dossier de domaine :

| Dossier | Périmètre |
|---|---|
| `cloud/` | Backend SaaS multi-tenant **pur** (Drizzle, Clerk, Stripe, Resend, schémas multi-org, endpoint `/v1/vps/register`, token rotatif Cloud-signed) — pas de pages UI |
| `sentinel/` | AI Copilot (LangGraph, tools status/logs/restart/deploy avec confirmation 2FA, routing modèles Ollama/Claude/GPT, memory pgvector, audit log) |
| `marketplace/` | Templates marketplace (schéma `arc-template.yml`, scanner Trivy, page Dashboard, Stripe Connect 70/30, 20 templates officiels) |
| `api/` | API publique REST + WebSocket sur `api.arc.euglowlabs.com`, OpenAPI doc, SDKs TypeScript / Python / Go, webhooks `project.deployed` etc., plugin system |
| `dashboard-l2-l3/` | **Pages UI** Dashboard Niveau 2 (`/topology`, `/business`, `/sandbox`, `/compliance`, `/cross-env`, notifications) **et Niveau 3** (`/billing`, `/team`). `/marketplace` et `/copilot` restent dans leurs domaines respectifs. |

À l'intérieur de chaque dossier, un fichier par tâche au format `[SCOPE]-NNN.md` (ex: `cloud/CLOUD-001.md`) — soit ré-importé depuis `tasks/INDEX.md` quand la séparation est créée, soit nouveau au moment où la planification Chantier 2 démarre.

## Pages Dashboard déplacées en Chantier 2

Spec produit §6.3 (Niveau 2) et §6.4 (Niveau 3) sont entièrement Chantier 2 :
- `/topology` (React Flow, audit visuel inter-réseaux)
- `/business` (économies vs cloud, coût par user)
- `/sandbox` (audit gouvernance, anomalies)
- `/compliance` (config diff)
- `/cross-env` (déplacée explicitement par ADR-0012 — multi-host nécessaire)
- `/marketplace`
- `/copilot` (Sentinel)
- `/team` (multi-user)
- `/billing` (Stripe Customer Portal embed)
