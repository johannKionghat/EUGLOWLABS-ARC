# Naming — EuglowLabs ARC

## Produit

- **Nom complet** : EuglowLabs ARC
- **Acronyme** : ARC = Autonomous Resource Cloud
- **N'utilise jamais** : "arc-monorepo", "Euglow ARC", "Arc Cloud" (orthographe minuscule = nom de browser)

## Repos & dossier

- Monorepo : `euglowlabs-arc` (dossier + repo GitHub `euglowlabs/euglowlabs-arc`)
- Si split futur : `euglowlabs/arc-cli`, `euglowlabs/arc-agent`, `euglowlabs/arc-dashboard`, `euglowlabs/arc-cloud`

## Packages npm

| Package | Nom |
|---|---|
| CLI | `@euglowlabs/arc-cli` |
| Dashboard | `@euglowlabs/arc-dashboard` |
| Cloud | `@euglowlabs/arc-cloud` |
| Shared (types, zod) | `@euglowlabs/arc-shared` |
| SDK public | `@euglowlabs/arc-sdk` |

## Binaires

- CLI installé : `arc` (court, mémorisable). Jamais `euglowlabs-arc` en CLI.
- Agent : `arc-agent` (binaire Go)

## Domaines

| Usage | Domaine |
|---|---|
| Landing + app SaaS | `arc.euglowlabs.com` |
| API publique | `api.arc.euglowlabs.com` |
| Documentation | `docs.arc.euglowlabs.com` |
| CDN templates | `cdn.arc.euglowlabs.com` |
| Install script | `install-arc.euglowlabs.com` |

## Tâches

Format `[SCOPE]-NNN` où SCOPE identifie le domaine fonctionnel :

| Scope | Domaine |
|---|---|
| `INFRA` | Setup monorepo, CI/CD, tooling |
| `CLI` | CLI `arc` |
| `AGENT` | ARC Agent (Go) |
| `DASH` | ARC Dashboard |
| `CLOUD` | ARC Cloud (SaaS backend) |
| `SHARED` | Package `arc-shared` |
| `MARKET` | Marketplace de templates |
| `SENTINEL` | AI Copilot |
| `DOC` | Documentation |
| `OPS` | Release, deploy, ops |

Numérotation `NNN` continue dans chaque scope (CLI-001, CLI-002, ...).

## Branches Git

Format : `<type>/<TASK-ID>-<slug-court>`

Types : `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `spike`

Exemples :
- `feat/CLI-042-add-deploy-command`
- `fix/AGENT-013-websocket-reconnect-loop`
- `refactor/SHARED-007-zod-config-schema`

## Commits

[Conventional Commits](https://www.conventionalcommits.org/) **avec ID de tâche en suffixe** :

```
<type>(<scope>): <description courte> [<TASK-ID>]
```

Exemples :
- `feat(cli): add deploy command [CLI-042]`
- `fix(agent): handle websocket reconnect [AGENT-013]`
- `chore(repo): bump turbo to 2.x [INFRA-005]`

## Identifiants techniques

- Variables d'env : `SCREAMING_SNAKE_CASE`, préfixe `ARC_` pour tout ce qui touche le produit (`ARC_AGENT_TOKEN`, `ARC_CLOUD_API_URL`)
- Réseaux Docker : `prod_net`, `ai_net`, `sandbox_net` (snake_case)
- Volumes Docker : `arc_<service>_data` (ex: `arc_postgres_data`)
- Containers : nom du service Compose, sans préfixe redondant
