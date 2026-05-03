# ADR-0009 : Mode dual `target: local | vps` avec pattern adapter

## Statut
**⛔ Superseded by [ADR-0012](./0012-single-machine-install.md) — 2026-05-03**
Initialement Accepté — 2026-05-01

> Le contenu ci-dessous est conservé comme référence historique. Le modèle dual `target: local | vps` n'est plus celui de ARC. Le modèle actif est documenté dans **ADR-0012 — Single-machine install model**.

## Contexte
Un solo founder doit pouvoir développer en local (WSL2 sur Windows, macOS, Linux) avec une expérience identique à la prod sur VPS. La spec infra §6 acte ce besoin : **"mêmes URLs, mêmes commandes, mêmes composes"** quel que soit le mode.

Les deux modes diffèrent uniquement sur :
- L'exécution des commandes (locale vs SSH distant)
- Le provisioning (aucun en local, API Hetzner en VPS)
- L'exposition publique (Cloudflare Tunnel en local, DNS A + Let's Encrypt en VPS)
- Le hardening (skip en local, UFW + fail2ban en VPS)

95% du code est partageable.

## Décision
Le fichier `arc.config.yml` contient un champ `target: local | vps`. Le CLI implémente un **pattern adapter** :

```typescript
interface ExecutionAdapter {
  exec(cmd: string, opts?: ExecOpts): Promise<ExecResult>
  copyFile(local: string, remote: string): Promise<void>
  // ...
}

class LocalAdapter implements ExecutionAdapter { /* execa direct */ }
class VPSAdapter implements ExecutionAdapter { /* node-ssh + Hetzner SDK */ }

const adapter = config.target === 'local' ? new LocalAdapter() : new VPSAdapter(config.provider)
await deployStack(adapter, config) // ← logique commune
```

En mode `local`, **Cloudflare Tunnel** est activé pour exposer `*.<domain>` via HTTPS sur la machine locale. Bascule vers `vps` = update DNS A + désactivation tunnel.

## Conséquences
+ **Mêmes URLs** en dev et en prod (`euglow.mondomaine.dev` pointe sur ta machine en local, sur ton VPS en prod)
+ Aucune env var à changer dans les apps Next.js entre les deux modes
+ Tests E2E peuvent tourner contre l'env local exposé par tunnel
+ Migration `local → vps` = simple changement d'un champ de config + `arc deploy`
- Cloudflare Tunnel ajoute une latence en dev local (~50-100ms) — acceptable
- Cohérence des ports et de la résolution DNS interne entre les deux adapters demande une attention particulière (CI inter-mode)

## Alternatives rejetées
- **Deux CLIs séparés** (`arc-local`, `arc-vps`) — duplication de logique, risque de divergence, UX dégradée
- **Docker Compose seulement, sans tunnel local** — pas d'URLs publiques en dev, casse le workflow OAuth callbacks externes
- **VPN type Tailscale** — alternative valable mais ajoute une dépendance + provisioning ; Cloudflare Tunnel suffit et reste gratuit pour ce volume
