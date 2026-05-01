# Coding Style — EuglowLabs ARC

## TypeScript (CLI, Dashboard, Cloud, shared)

### Config tsconfig
- `strict: true` — non négociable
- `noUncheckedIndexedAccess: true` — non négociable
- `exactOptionalPropertyTypes: true` recommandé sur `arc-shared`
- `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`

### Règles de code
- **Zéro `any`** sauf justification commentée du type :
  ```ts
  // arc-allow-any: cast nécessaire pour SDK Hetzner v3 (types incomplets upstream)
  ```
- **Pas de `default export`** sauf pour pages Next.js (App Router l'exige)
- **Imports ordonnés** :
  1. dependencies externes (`react`, `zod`, `clipanion`, ...)
  2. dependencies internes monorepo (`@euglowlabs/arc-shared`, ...)
  3. relatifs (`./adapters/local`, `../config`)
  Une ligne vide entre chaque groupe.
- **Pas de `console.log` committé** (`console.error` en CLI OK pour erreurs utilisateur)
- **JSDoc** sur toute fonction exportée publique d'un package (TSDoc syntax)
- **Pas de `enum`** — utiliser `as const` + union types
- **Préférer `type` pour les unions, `interface` pour les contrats étendables**

### Naming
- Fichiers : `kebab-case.ts` (ex: `vps-adapter.ts`)
- Composants React : `PascalCase.tsx` (ex: `ProjectCard.tsx`)
- Fonctions / variables : `camelCase`
- Types / interfaces : `PascalCase`
- Constantes top-level : `SCREAMING_SNAKE_CASE`

### Linter / formatter
- **Biome** comme formatter + linter (rapide, zéro config)
- ESLint réservé aux règles que Biome ne couvre pas (rare)

## Go (ARC Agent)

### Règles de code
- `gofmt` obligatoire (CI rejette sinon)
- **Erreurs jamais ignorées** — `_ = err` interdit en code de production
- **Pas de `panic()`** en production hors `main.go` startup
- **Comments godoc** sur tous les symboles exportés
- `golangci-lint run` avec config standard + `errcheck` + `gosec`

### Layout
```
packages/arc-agent/
├── cmd/agent/main.go         # entry point
├── internal/
│   ├── api/                  # HTTP handlers
│   ├── docker/               # Docker SDK wrappers
│   ├── metrics/              # Prometheus collectors
│   └── auth/                 # token verification
├── pkg/                      # public API si SDK exposé
└── Makefile
```

## CSS / Tailwind

- Tailwind utility-first, pas de CSS custom sauf cas extrême
- shadcn/ui pour les primitives (Button, Dialog, Input, ...)
- Variables design dans `tailwind.config.ts` centralisé dans `arc-shared/ui/tailwind-preset.ts`
- Pas de `!important` jamais, sauf override de lib externe avec commentaire

## Commentaires

- Par défaut : **pas de commentaire**. Le code bien nommé se lit seul.
- Un commentaire est justifié quand il explique le **pourquoi** non-évident :
  - Workaround d'un bug upstream (lien issue)
  - Invariant subtil (ex: "ce mutex protège aussi `state.json` via `flock`")
  - Décision contre-intuitive référençant un ADR
- Pas de commentaires `// updated by X` ou `// removed Y` — Git fait ce job
