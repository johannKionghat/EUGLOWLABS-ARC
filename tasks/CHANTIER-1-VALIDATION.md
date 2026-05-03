# Chantier 1 — Checklist de validation

> Fixée par [ADR-0013](../docs/03-architecture-decisions/0013-chantier-1-2-separation.md).
> Tant que les 4 cases ne sont pas toutes cochées ET que je n'ai pas envoyé le message exact `"go chantier 2"`, le périmètre Chantier 2 reste **gelé**.

Cette checklist est à cocher **par moi (l'auteur), pas par un agent**. Aucun agent n'a le droit de cocher une case ici sans confirmation explicite.

---

## ☐ 1. Les 25 critères d'ADR-0011 passent

- [ ] Les **25 critères** d'[ADR-0011](../docs/03-architecture-decisions/0011-end-to-end-install-acceptance.md) sont **tous validés** sur un VPS de test fraîchement provisionné.
- Validation par : Phase 4 (VALIDATE-001 à VALIDATE-007) côté infra + suite E2E (E2E-001) côté CLI/commandes + Tests Playwright (DASH-013) côté Dashboard.

## ☐ 2. Dashboard self-hosted Niveau 1 sur mon VPS de test

- [ ] Le Dashboard self-hosted Niveau 1 tourne sur mon VPS de test, accessible via HTTPS sur un domaine réel (Let's Encrypt actif).
- [ ] Les pages `/overview`, `/projects`, `/projects/[id]`, `/ai-stack`, `/settings` se chargent et affichent des données réelles (pas de mock).
- [ ] L'auth single-user marche, le streaming WebSocket reçoit les métriques en temps réel.

## ☐ 3. `docs/migration-guide.md` complet et testé par moi

- [ ] DOC-001 livré, les 6 sections (migrer Next.js + Postgres, déplacer une instance, dupliquer en staging, install sans IP publique, rollback, troubleshooting) sont écrites et copiables.
- [ ] J'ai exécuté à la main au moins **§1 (migrer Next.js + Postgres)** sur un projet de test, en moins de 30 minutes, sans aide externe. C'est ce qui valide le critère C1 d'ADR-0011.

## ☐ 4. Validation explicite

- [ ] J'envoie dans la conversation le message **exact** : `go chantier 2`
- Date du message : ____________

---

## Quand TOUTES les 4 cases sont cochées

L'agent peut **commencer** Chantier 2 (Cloud / Sentinel / Marketplace / API & SDKs / pages Dashboard Niveau 2-3).

Avant validation : règle non-négociable de `CLAUDE.md` interdit de toucher à `tasks/backlog/chantier-2-deferred/`.

---

## Migrations des 4 projets de l'auteur — POST-LIVRAISON

Les migrations des 4 projets (EuglowLabs.com, InfinixUI, InfinixLoop, EduMatch) **ne sont pas dans cette checklist**. Ce sont des actes d'utilisation que je réalise moi-même quand le produit est livré, pas des conditions de livraison.

Vercel ne livre pas en migrant les sites de ses clients ; ARC ne se livre pas en migrant les miens. Voir ADR-0011 §"Important — Migration des projets ≠ critère de livraison".
