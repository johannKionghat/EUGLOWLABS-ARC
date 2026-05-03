# Dashboard Niveau 2 / 3 — tâches Chantier 2 deferred 🧊

> ⛔ Gelé par ADR-0013. Voir `../README.md`.

> Pages spec produit §6.3 (Niveau 2) et §6.3.6 (Notifications). La page `/cross-env` est explicitement déplacée ici par ADR-0012 (multi-host nécessaire).

| ID | Titre | Source spec |
|---|---|---|
| DASH-L2-001 | Page `/topology` — graph réseau React Flow + audit visuel inter-réseaux | §6.3.1 |
| DASH-L2-002 | Page `/business` — métriques économies vs cloud (Vercel + Supabase + OpenAI) + coût/projet + coût/user | §6.3.2 |
| DASH-L2-003 | Page `/sandbox` — audit gouvernance, historique des exécutions, anomalies, RAM moyenne | §6.3.3 |
| DASH-L2-004 | Page `/compliance` — diff config/réel, services drift, modèles Ollama listés vs chargés, bouton Reconcile | §6.3.4 |
| DASH-L2-005 | Page `/cross-env` — vue local↔VPS (versions apps, état Postgres, Ollama models) — **multi-host** | §6.3.5 (déplacée par ADR-0012) |
| DASH-L2-006 | Notifications custom (Discord webhook, email, Slack, custom webhook) + règles "alerte si app down > 2 min" | §6.3.6 |
| DASH-L3-001 | Page `/billing` — Stripe Customer Portal embed *(ex-CLOUD-011)* | spec produit §7 |
| DASH-L3-002 | Page `/team` — liste membres + invitations *(ex-CLOUD-012)* | spec produit §7 |

> Les pages Niveau 3 dépendant de domaines spécifiques (`/marketplace` côté templates, `/copilot` côté Sentinel) restent dans leurs dossiers respectifs (`marketplace/`, `sentinel/`). Les pages Niveau 3 du backend Cloud (`/billing`, `/team`) sont ici, le backend lui-même est dans `cloud/`.
