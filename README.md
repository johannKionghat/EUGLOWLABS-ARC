# EuglowLabs ARC

> *Autonomous Resource Cloud* — turn any VPS into a self-hosted "Vercel + Supabase + Ollama" cockpit, in one command.

EuglowLabs ARC is a tooling stack for solo founders who want to run their entire SaaS infrastructure on a single VPS without paying per-seat for Vercel + Supabase + OpenAI + Sentry + Stripe. It bundles a CLI, an Agent, a Dashboard, and a multi-tenant SaaS layer — each shippable on its own.

This repository is a `pnpm` + `Turborepo` monorepo. It is **work in progress**; Phase 1 (CLI MVP) is complete, the rest is in flight.

---

## Components

| Package | Status | Role |
|---|---|---|
| `@euglowlabs/arc-cli` | Phase 1 ✅ | Bootstrap, deploy, backup, migrate, project mgmt — entry point of the product |
| `@euglowlabs/arc-shared` | Phase 1 ✅ | Zod schemas + types shared across CLI / Agent / Cloud |
| `arc-agent` (Go) | Phase 2 ⬜ | Lightweight service installed on each managed VPS, exposes state to the Dashboard |
| `@euglowlabs/arc-dashboard` | Phase 3 ⬜ | Self-hosted Next.js cockpit |
| `@euglowlabs/arc-cloud` | Phase 4 ⬜ | Multi-tenant SaaS backend (closed source) |

See [`docs/02-spec-arc-product.md`](docs/02-spec-arc-product.md) for the full product spec, [`docs/01-spec-infra.md`](docs/01-spec-infra.md) for the infrastructure spec.

---

## CLI quickstart (Phase 1)

The CLI is the only component shippable today.

```bash
# Build the binary for your platform (Bun must be on PATH)
pnpm install
pnpm --filter @euglowlabs/arc-cli build:bin
./packages/arc-cli/bin/arc-linux-x64 version
# arc 0.0.0
```

Or, when published to GitHub Releases:

```bash
curl -fsSL https://arc.euglowlabs.com/install.sh | sh
arc init
arc deploy --dry-run
```

### Available commands

```
arc help                       # Banner + command list
arc init                       # Interactive config generator → arc.config.yml
arc deploy [--dry-run]         # Render compose files + apply (target=local for now)
arc status                     # docker compose ps parsed
arc logs <service>             # tail logs
arc restart <service>
arc backup --volume <name>     # pg_dumpall + tar.gz volumes
arc restore [<id>]             # list / apply
arc project add <name>         # Coolify + create database
arc project list / deploy <name>
arc migrate --to <host>        # backup → copy → deploy → restore on a VPS
arc config telemetry on|off|status
arc version                    # also: --version
```

---

## Repository layout

```
euglowlabs-arc/
├── docs/                       # Specs, ADRs, conventions, glossary
│   ├── 01-spec-infra.md
│   ├── 02-spec-arc-product.md
│   ├── 03-architecture-decisions/
│   ├── 04-conventions/
│   └── 05-glossary.md
├── packages/
│   ├── arc-cli/                # CLI (Bun + clipanion)
│   ├── arc-shared/             # Zod schemas + types
│   ├── arc-dashboard/          # Next.js (placeholder)
│   ├── arc-cloud/              # Next.js SaaS (placeholder)
│   └── arc-agent/              # Go agent (placeholder)
├── tasks/                      # INDEX + current + completed/
├── CLAUDE.md                   # AI agent contract for this repo
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Contributor quickstart

```bash
# Prerequisites
node >= 20.18.1   # see .tool-versions
pnpm  9.14.2
bun   1.1.38      # only for `pnpm --filter arc-cli build:bin`
go    1.23        # only for arc-agent

# Install
pnpm install

# Quality gates run on every PR (CI: Node + Go jobs)
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### Conventions you must follow

- One PR = one task `[SCOPE-NNN]`, max ~2h of work
- Conventional Commits **with TASK-ID**: `feat(cli): add deploy command [CLI-042]`
  (enforced locally by lefthook + a small commit-msg script)
- TypeScript `strict`, `noUncheckedIndexedAccess`, zero `any` without justification
- Coolify is a **dependency**, never forked — see [ADR-0005](docs/03-architecture-decisions/0005-coolify-as-dependency-not-fork.md)
- All structural decisions live in [`docs/03-architecture-decisions/`](docs/03-architecture-decisions/)

For agents working in this repo, the contract is in [`CLAUDE.md`](CLAUDE.md).

---

## Roadmap

8 phases, ~10–12 months in solo. Tracked in [`tasks/INDEX.md`](tasks/INDEX.md).

| Phase | Scope | State |
|---|---|---|
| 0 | Setup monorepo & tooling | 9/10 |
| 1 | CLI MVP | **28/28 ✅** |
| 2 | ARC Agent (Go) | 0/14 |
| 3 | Dashboard Niveau 1 | 0/15 |
| 4 | ARC Cloud MVP | 0/14 |
| 5 | Sentinel AI Copilot | 0/7 |
| 6 | Marketplace | 0/8 |
| 7 | Public API + SDKs | 0/8 |
| 8 | Polish & growth | 0/9 |

---

## License

`@euglowlabs/arc-cli`, `@euglowlabs/arc-shared`, `arc-agent`, `@euglowlabs/arc-dashboard` — **Apache 2.0** (see [LICENSE](LICENSE) once published).
`@euglowlabs/arc-cloud` — closed source.

---

## Built on

[Coolify](https://github.com/coollabsio/coolify) · [`local-ai-packaged`](https://github.com/coleam00/local-ai-packaged) · [Clipanion](https://github.com/arcanis/clipanion) · [Bun](https://bun.sh) · [Turborepo](https://turbo.build) · [Biome](https://biomejs.dev) · [Vitest](https://vitest.dev)
