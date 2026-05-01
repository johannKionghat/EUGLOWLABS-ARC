# ADR-0005 : Coolify est une dépendance, jamais une fork

## Statut
Accepté
Date : 2026-05-01

## Contexte
EuglowLabs ARC s'appuie fortement sur Coolify (PaaS open-source, Apache 2.0) pour le deploy Git, le SSL Let's Encrypt, la gestion des env vars et l'intégration Traefik. Coolify couvre ~60% du périmètre opérationnel de la stack déployée.

La licence Apache 2.0 permet techniquement de forker. Mais l'équipe Coolify a publié une **demande éthique explicite** : ne pas rebrander, ne pas créer de "Coolify with extras" qui détourne la communauté. Au-delà de l'éthique, un fork imposerait de maintenir la parité features avec Coolify upstream — coût catastrophique pour un solo founder.

ARC se positionne comme **couche au-dessus** de Coolify, pas comme alternative.

## Décision
EuglowLabs ARC **utilise Coolify comme dépendance externe**, **jamais comme fork**.

Règles non-négociables :
1. Le CLI `arc` installe Coolify via leur installer officiel ou via Docker Compose officiel
2. ARC Agent **consomme l'API Coolify**, ne la modifie pas
3. README et site contiennent l'attribution **"Built on Coolify"** avec lien vers `coollabs.io`
4. Les contributions upstream sont encouragées : si on a besoin d'une feature Coolify, on l'ouvre en PR upstream avant tout fork patch
5. Un sponsoring GitHub vers Coolify est mis en place dès la phase payante d'ARC
6. Jamais de logo Coolify dans la marque ARC ; jamais de mention "powered by ARC" sur Coolify

## Conséquences
+ Coût de maintenance ARC borné — pas de duplication de features Coolify
+ Communauté Coolify alignée et bienveillante envers ARC
+ Position défendable juridiquement et éthiquement
+ Liberté de switch vers Dokploy en option (cf. spec infra §2.2) sans dépendance dure
- Si Coolify change leur API ou pivote la licence (ex: Apache → BSL), ARC doit s'adapter
- Mitigation pivot licence : maintenir Dokploy comme adapter alternatif validé en CI

## Alternatives rejetées
- **Forker Coolify et rebrander** — interdit par éthique, coût de maintenance prohibitif, mauvais signal à la communauté
- **Réimplémenter un PaaS from scratch** — 2-3 ans de travail, hors scope solo founder
- **N'utiliser que Docker Compose brut** — perte du deploy Git push, gestion env vars manuelle, UX dégradée vs concurrents
