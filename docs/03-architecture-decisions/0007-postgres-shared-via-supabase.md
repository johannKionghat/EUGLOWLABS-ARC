# ADR-0007 : Une seule instance Postgres partagée via Supabase self-hosted

## Statut
Accepté
Date : 2026-05-01

## Contexte
Sur un VPS unique (CX32, 8 Go RAM), faire tourner N projets utilisateur (EuglowLabs, InfinixUI, EduMatch, ...) implique des choix de mutualisation. La spec infra §2.4 prescrit Postgres self-hosted via le bundle `local-ai-packaged` (qui inclut Supabase complet : Postgres + Auth + Storage + Studio + pgvector + GoTrue).

L'alternative naïve est "1 stack Supabase complète par projet" → plusieurs Go de RAM consommés rien qu'en PostgREST + GoTrue dupliqués, plus difficile à maintenir.

## Décision
Une **unique instance Supabase self-hosted** (déployée via `local-ai-packaged`) tourne sur le VPS / le local. Cette instance fournit Postgres + Auth + Storage + pgvector + Studio.

Chaque projet utilisateur (Euglow, InfinixUI, ...) reçoit **une database Postgres dédiée** dans cette instance unique. Les credentials sont scopés par database et injectés via les env vars Coolify.

Le CLI `arc project add <name>` :
1. Crée une database `name` dans le Postgres partagé
2. Crée un user `name_user` avec privilèges scopés à cette DB
3. Pousse les credentials dans Coolify env vars du projet

## Conséquences
+ Empreinte mémoire raisonnable sur VPS petit/moyen (~1 Go pour la stack Supabase totale)
+ Backup unifié : un seul `pg_dumpall` couvre tous les projets
+ pgvector disponible pour tous les projets sans réinstallation
+ Studio Supabase unique pour ops cross-projets
- Un projet abusif peut saturer Postgres et impacter les voisins → mitigation : monitoring + limits par DB en phase 4
- Migration vers "1 instance par projet" reste possible plus tard si scale l'exige

## Alternatives rejetées
- **1 instance Supabase complète par projet** — duplication PostgREST/GoTrue, RAM x N, ops lourd
- **Postgres standalone (sans Supabase)** — perd Auth, Storage, Studio "for free" ; incohérent avec `local-ai-packaged`
- **SQLite par projet** — incompatible avec pgvector / RAG ; pas de scale possible
