# ADR-0003 : Go comme langage d'implémentation d'ARC Agent

## Statut
Accepté
Date : 2026-05-01

## Contexte
ARC Agent est un service installé sur **chaque VPS managé** par un utilisateur ARC. Il :
- Expose une API HTTP authentifiée (status, logs, metrics, deploy)
- Stream des métriques en WebSocket vers le Dashboard
- Parle au Docker socket et aux APIs internes (Coolify, Ollama, Langfuse, Uptime Kuma)
- Doit tourner 24/7 avec une empreinte mémoire faible

Contraintes :
- Empreinte minimale (utilisateurs avec VPS 4-8 Go RAM partagés avec apps + Ollama)
- Pas de runtime à installer côté utilisateur (l'Agent doit être un binaire posé par le CLI)
- Compilation cross-target (linux/amd64 et linux/arm64 pour ARM Hetzner)
- Robustesse face aux crashs

## Décision
ARC Agent est écrit en **Go**, compilé en binaire statique ~10 Mo distribué via GitHub Releases.

Stack figée :
- HTTP : `chi` (préféré) ou `echo`
- WebSocket : `gorilla/websocket`
- Docker : `docker/docker` SDK officiel
- Metrics : `prometheus/client_golang`
- Test : `go test` standard + `testify`

## Conséquences
+ Binaire ~10 Mo, démarrage < 50ms, RAM idle < 30 Mo
+ Pas de runtime requis sur le VPS utilisateur
+ Cross-compilation triviale (`GOOS=linux GOARCH=arm64 go build`)
+ Stdlib HTTP + concurrence native (goroutines) idéale pour streaming WS
- Langage différent du reste du monorepo (TS) → friction de contexte
- Partage de types avec le Dashboard via OpenAPI codegen (zod ↔ Go structs)
- Hors graphe Turborepo : build via Makefile dédié dans `packages/arc-agent/`

## Alternatives rejetées
- **Node/Bun** — empreinte trop lourde (50-100 Mo binaire avec `bun build --compile`), RAM ~80 Mo, latence start-up plus haute
- **Rust** — overkill pour ce qui est essentiellement un serveur HTTP d'agrégation ; courbe d'apprentissage qui retarde la roadmap solo
- **Deno** — single binary mais plus lourd que Go, moins de SDK Docker matures
