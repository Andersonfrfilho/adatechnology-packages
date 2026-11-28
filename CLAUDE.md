# CLAUDE.md — Full-Stack Monorepo

Unified monorepo for backend NestJS libraries (`packages/backend/`) and frontend/mobile client libraries (`packages/frontend/`).

## Structure Overview

**Catálogo completo de capacidades: [docs/CATALOGO.md](docs/CATALOGO.md).** Antes de escrever código num app, procure lá pela necessidade (atendimento WhatsApp, robô/fluxo, simulador de conversa, painel de conversas, login e equipe, cadastro de clientes, catálogo, notificações e modelos, agenda, upload, log, nota fiscal, pagamentos, calendários, blog/novidades, cupons e promoções, ficha técnica e lista de compras). Simulador de conversa, motor de fluxos e editor de modelos já existem aqui; não reimplemente.

```
packages/
├── backend/    65 pastas, 63 pacotes (@adatechnology/*)
│   ├── Trios contracts / module / provider+ui: conversation, meta-whatsapp, notification, user,
│   │   customer, catalog, scheduling, recommendation, payment, expense, infra, content, coupon, recipe
│   ├── Providers (stateless): email, push, object-storage, rabbitmq, audio-transcription,
│   │   text-moderation, product-vision, google/microsoft/caldav-calendar, mercadopago/hotmart-payment,
│   │   ifood/food99/opendelivery-marketplace, fiscal, evolution-whatsapp, meta-graph-core/-catalog
│   ├── Infra e utilitários: module-http, drizzle-provider, logger, http-client, cache, auth-keycloak,
│   │   keycloak-jwt, keycloak-admin, secret-envelope, identity-reconciliation, media-processor, cargo-placement
│   ├── nestjs-* (logger, cache, http-client, auth-keycloak, keycloak-admin) e shared / nestjs-package (privados)
│   └── example/bun-app, meta-business/catalog (cópia da doc da Meta; não é pacote)
├── frontend/   15 pastas: conversations-ui (inbox, editor de fluxos, simulador), notification-ui/-client,
│               user-ui, customers-ui, products-ui, content-ui, coupons-ui, recipes-ui, recommendations-ui, scheduling-ui, infra-ui,
│               web-chat-widget, web-booking-widget, image-cutout, document-intake, logger-client, example
└── mcp/        audio-transcription-mcp, expense-mcp
```

### Catálogo é obrigatório

Todo PR que cria um pacote ou adiciona uma capacidade a um pacote existente **atualiza a entrada correspondente em `docs/CATALOGO.md` no mesmo PR**: versão, o que o consumidor ganha, entradas (fábricas e componentes exportados), infra necessária, compatibilidade e, na seção de necessidades, a linha "necessidade → pacote". Sem isso o próximo agente reescreve à mão o que já existe.

## Common Commands

```bash
# Build
pnpm run build:all              # Build all packages
pnpm run build:backend          # Build only backend NestJS libraries
pnpm run build:frontend         # Build only frontend libraries
pnpm run build:example          # Build example app
pnpm run watch:packages         # Watch and rebuild on changes

# Publishing
pnpm changeset                  # Create changeset for changes
pnpm changeset version          # Bump versions from changesets
pnpm changeset publish          # Publish to npm
```

## Publishing Rules

### Backend Packages (@adatechnology/nestjs-*)
- Semver: `packages/backend/nestjs/{package}/package.json`
- Scope: `@adatechnology`
- Prefix: `nestjs-` (runtime clarity)
- Published to npm automatically via changesets
- Consumer services: api, bff, cron, worker

### Frontend Packages (@adatechnology/logger-client, etc.)
- Semver: `packages/frontend/{package}/package.json`
- Scope: `@adatechnology`
- Suffix: `-client` (optional, depends on package)
- Published to npm automatically via changesets
- Consumer apps: cawme-client (mobile), cawme-web (React)

### @adatechnology/shared
- Never published
- Internal utilities for backend libraries
- Always use `workspace:*` for references

## Adding a New Package

> Qualquer pacote novo (ou capacidade nova num pacote) entra em `docs/CATALOGO.md` no mesmo PR. Ver "Catálogo é obrigatório" acima.

### Backend NestJS Library
```bash
cd packages/backend/nestjs
# Copy template from existing library
cp -r logger nestjs-my-lib
cd nestjs-my-lib
# Edit package.json: update name to @adatechnology/nestjs-my-lib
# Implement src/index.ts with exports
pnpm install  # from root, updates lock
pnpm run build:backend
```

### Frontend Library
```bash
cd packages/frontend
mkdir my-client-lib
cd my-client-lib
# Create package.json:
# - name: @adatechnology/my-client-lib
# - type: module (ESM)
# - build script
# Create src/index.ts
pnpm install  # from root
pnpm run build:frontend
```

## Architecture Principles

### 1. AsyncLocalStorage (ALS) for Context
Request-scoped context propagation without OTel `context.with()` limitations:
```ts
import { getContext, runWithContext, pushToTraceStack } from '@adatechnology/nestjs-logger';

// In middleware:
runWithContext({ requestId: req.id }, async () => { ... });

// In services:
const ctx = getContext();  // Per-request, no concurrency issues
```

### 2. TraceStack — Hierarchical Call Tracing
```ts
import { pushToTraceStack, popFromTraceStack } from '@adatechnology/nestjs-logger';

// In @TraceMethod():
pushToTraceStack(`${ClassName}.${methodName}`);
try {
  return await originalMethod(...args);
} finally {
  popFromTraceStack();
}
```

Log output:
```
[requestId][timestamp][api:0.0.3][UserService.create][CreateUserUseCase.execute][INFO] - Created
```

### 3. Distributed Tracing via Headers
**Frontend → Backend → Backend:**

1. Frontend generates `requestId` (UUID)
2. Calls API with headers:
   - `x-request-id: <requestId>`
   - `x-trace-id: <traceId>` (if known from previous response)

3. API receives, creates OTel trace, injects `traceId` into logs
4. API returns response with header:
   - `x-trace-id: <traceId>` (from OTel span)

5. Frontend stores `traceId` for subsequent requests
6. Correlation: `requestId` + `traceId` → Loki + Jaeger lookup

### 4. Consumer Service Patterns
Services consuming these libraries (`domestic-backend-api`, etc.) must:

- **Middleware**: Implement `PackageContextMiddleware` (pushes `requestId` + `projectName:version` to stack)
- **Decorators**: Use `@TraceMethod()` on all service methods
- **Initialization**: Call `initTracing()` in `instrumentation.ts` (before app starts)
- **Config**: Enable `TraceStack`, `fileTransport`, `TracingConfig` in `LoggerModule.forRoot()`

## Type Safety

### Decorator Metadata Rule (TS1272)
When `emitDecoratorMetadata: true` and decorator is on a method, parameter types must use `import type`:

```ts
import type { MyParams } from './types';

@TraceMethod()
async execute(params: MyParams): Promise<Result> { ... }
```

❌ Wrong:
```ts
import { MyParams } from './types';  // ERROR TS1272: Missing `type` keyword
@TraceMethod()
async execute(params: MyParams) { ... }
```

## Frontend Package Usage

### @adatechnology/logger-client
Isomorphic client for request tracing in React Native, web, Node.js, Electron:

```ts
import { initTraceContext } from '@adatechnology/logger-client';

// Initialize once at app startup
const traceContext = initTraceContext({
  requestId: generateUUID(),
  // storageKey: 'trace-context' (default)
  // headerNames: { requestId: 'x-request-id', traceId: 'x-trace-id' } (default)
});

// Wrap API calls
const response = await traceContext.fetch('/api/users', {
  method: 'POST',
  body: JSON.stringify({ name: 'John' }),
});

// Logs automatically include [requestId][traceId] prefix
traceContext.info('Request completed', { status: response.status });

// Get current trace context
const { requestId, traceId } = traceContext.getContext();
```

## Testing & Local Development

### Build Verification
```bash
pnpm run build:all
```

### Watch Mode
```bash
pnpm run watch:packages    # Rebuild on file changes
```

### Example App
```bash
pnpm run build:example     # Build example (NestJS test app)
pnpm --filter=example run start:dev
```

## Codebase Knowledge Graph (Graphify)

This repo has a [Graphify](https://graphify.net/) knowledge graph (`graphify-out/`, gitignored — regenerable, never commit it) covering both code (AST, 339 files) and docs (50 files).

- **Kept up to date automatically** — `post-commit` and `post-checkout` git hooks (installed via `graphify hook install`, see `.husky/post-commit` and `.husky/post-checkout`) rebuild the code graph in the background after every commit and branch switch. No manual step needed, no LLM call (code-only rebuild).
- **Manual refresh** (only needed after pulling doc/markdown changes, which the hooks don't re-run semantic extraction for): `graphify update .` (code, free) or `graphify extract . --token-budget 20000` (full rebuild incl. docs, costs a small amount of LLM tokens — this org's OpenAI TPM limit is 30k, so keep `--token-budget` below that).
- **Querying**: use the `/graphify` skill or CLI (`graphify query "<question>"`, `graphify affected "<file>"`, `graphify path "A" "B"`, `graphify explain "<node>"`) instead of grepping the whole repo for cross-cutting questions (e.g. "what depends on the fiscal-provider interfaces").

## Publishing Flow

1. **Make changes** in a package
2. **Create changeset**:
   ```bash
   pnpm changeset
   # Select affected packages, choose version bump (patch/minor/major)
   ```
3. **Review changeset** at `.changeset/PRXXXX.md`
4. **Version bump** (optional, can be done by CI):
   ```bash
   pnpm changeset version
   ```
5. **Commit & push**:
   ```bash
   git commit -am "feat/fix: description"
   git push origin main
   ```
6. **CI publishes** automatically via `.github/workflows/publish.yml`

### Only `main` publishes

`publish.yml` runs on `push` to **`main`** (plus manual `workflow_dispatch`). Pushing a feature
branch or opening a PR runs no publish job — the registry stays on the previous version until the
PR is merged. This matters because a consumer repo that already depends on the new API will keep
failing CI with type errors that look like bugs in the consumer; the actual cause is that the
version it needs does not exist yet.

Ordering when a change spans this repo and a consumer:

1. merge the PR here → `publish.yml` runs `changeset version`, commits the bump, then
   `changeset publish`;
2. confirm the registry: `npm view @adatechnology/<pkg> dist-tags`;
3. only then bump the dependency in the consumer and let its CI run.

Publishing is never done by hand — the `NPM_TOKEN` lives only in the repo secrets, so a local
`changeset publish` fails with 401 even for a maintainer who can push.

### Prerelease (`rc`) mode

`.changeset/pre.json` has `mode: "pre"` with tag `rc`, so releases go out as `x.y.z-rc.N` under
the **`rc` dist-tag** — `npm install <pkg>` (the `latest` tag) does **not** get them. Consumers must
pin the exact `rc` version. Leaving prerelease mode is `pnpm changeset pre exit`, and is a deliberate
decision, not a step in the normal flow.

### Mirroring `dist` locally while a version is unpublished

To validate a consumer against unpublished changes, build here and copy `dist/` into the consumer's
`node_modules` (and into its container, if it runs in Docker with a named volume for
`node_modules` — a host-side copy never reaches the container). This is a temporary harness: any
`bun install --force` / `pnpm install` silently restores the published version, and the consumer's
CI never sees the mirrored files. Never treat a green local typecheck under a mirrored `dist` as
evidence that the consumer builds.

## Troubleshooting

### "no matching version found" during `pnpm install`
→ Check `package.json` workspace protocol: `workspace:*` means "use current version locally"

### "Multiple versions of package X"
→ Run `pnpm install` from monorepo root (not subdirectory)

### "TS1272: A type referenced in a decorated signature must be imported with 'import type'"
→ Use `import type` for all parameter/return types on methods with `@TraceMethod()`

### Build succeeds but types missing in dist/
→ Verify `package.json` has `"types": "dist/index.d.ts"` and build script includes `--dts`
