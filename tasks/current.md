# Tâche en cours : CLI-011 — `VPSAdapter` via node-ssh + Hetzner SDK

## Statut
🟡 En cours — démarrée le 2026-05-02

## Objectif
Deuxième impl concrète de `ExecutionAdapter` (CLI-009). SSH via `node-ssh`, SFTP upload, lecture FS distante via `cat`. Provisioning Hetzner extrait dans `provisionHetzner(provider)` séparé.

## Critères
- [ ] `VPSAdapter` implémente `ExecutionAdapter` via node-ssh
- [ ] `provisionHetzner(provider)` skeleton (création VPS via SDK)
- [ ] `describe(): "vps:<host>"`
- [ ] Tests structurels (pas de E2E SSH — AGENT-012)
- [ ] Lint/typecheck/build verts, CI verte, PR mergée

## ADRs
ADR-0009 (impl VPS), ADR-0001, ADR-0002

## Hors scope
E2E SSH/Hetzner (AGENT-012), mocking complet node-ssh, commande clipanion (CLI-012), lifecycle complexe.

## Plan
1. Deps `node-ssh` + Hetzner SDK
2. `VPSAdapter` lazy connect
3. `provisionHetzner` skeleton
4. Tests structurels
5. Vérif + commit + PR

## Scratchpad
- Lazy connect
- `provisionHetzner` séparé du VPSAdapter
- Tests minimaux (E2E reportés AGENT-012)
