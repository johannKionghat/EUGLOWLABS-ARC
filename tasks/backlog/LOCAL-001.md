# LOCAL-001 — Mode local dev (WSL Ubuntu / Linux laptop)

**Priorité : HIGH — élargit significativement le marché cible.**
**Statut : backlog post-DIST-001.**

## Contexte

ARC actuel (Phase 1.5) cible exclusivement un VPS Linux distant durable :
- Hardening (UFW, fail2ban, SSH key-only) suppose machine exposée internet
- Coolify avec TLS Let's Encrypt suppose IP publique + domaine
- Backups R2 supposent durabilité 24/7

Cas d'usage non-couvert : un dev solo sur Windows + WSL Ubuntu (ou Mac/Linux laptop) qui veut un environnement self-hosted **local** pour expérimenter avec son projet personnel, sans louer de VPS.

Découvert le 2026-05-08 par Johann pendant cadrage DIST-001.

## Cible utilisateur

Dev solo qui veut :
- Tester ARC sans investissement (pas de VPS à louer)
- Avoir un Coolify + ai-stack en local pour prototyper
- Funnel naturel : "j'ai validé en local → je passe en prod sur VPS"

## Décision stratégique actée

Direction B : ajouter mode `--mode local` à `arc setup --apply`. À FAIRE APRÈS DIST-001.

## Spec technique préliminaire

Commande : `arc setup --apply --mode local`

Skip en mode local :
- UFW, fail2ban, SSH hardening (pas exposé)
- Backups R2 cron (optionnel via --enable-backups)
- TLS Let's Encrypt sur Coolify (HTTP localhost suffit)

Garde en mode local :
- Docker engine + 3 networks Docker
- Coolify (localhost:8000)
- ai-stack (Supabase, Ollama, n8n, SearXNG)
- Sandbox isolation

Détection WSL :
- Si grep -qi microsoft /proc/version → mode local recommandé
- Warning si --mode prod sur WSL

## Découpage estimé

- 1a — Refactor playbooks Ansible avec tags {prod, local} (~3h)
- 1b — Flag --mode {prod,local} dans CLI + détection WSL auto (~1h)
- 1c — Tests Vitest variant prod/local (~2h)
- 1d — Doc section WSL/local dans installation.md (~1h)
- 1e — Smoke local sur WSL Ubuntu jetable (~2h)

Total : ~1-2 jours.

## Critères d'acceptation

- [ ] arc setup --apply --mode local fonctionne sur WSL Ubuntu
- [ ] Détection WSL automatique avec recommandation mode local
- [ ] Skip propre des rôles non-applicables
- [ ] Coolify accessible sur localhost:8000 sans TLS
- [ ] ai-stack démarre proprement
- [ ] Doc installation.md couvre Windows+WSL flow complet
- [ ] Pas de régression mode prod

## Bloquant pour

- Onboarding solos dev sans VPS
- Funnel d'acquisition "essai gratuit local → prod payant VPS"

## Pas bloquant par

- DIST-001 doit être livré d'abord
- ARC Agent (Phase 2) — orthogonal
