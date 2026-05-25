# CLAUDE.md — Full-Stack Monorepo

Unified monorepo for backend NestJS libraries (`packages/backend/`) and frontend/mobile client libraries (`packages/frontend/`).

## Structure Overview

```
packages/
├── backend/
│   ├── nestjs-logger/           @adatechnology/nestjs-logger (published to npm)
│   ├── nestjs-cache/            @adatechnology/nestjs-cache (published to npm)
│   ├── nestjs-http-client/      @adatechnology/nestjs-http-client (published to npm)
│   ├── shared/                  @adatechnology/shared (internal, not published)
│   ├── nestjs-auth-keycloak/    @adatechnology/nestjs-auth-keycloak (published to npm)
│   ├── nestjs-keycloak-admin/   @adatechnology/nestjs-keycloak-admin (published to npm)
│   ├── nestjs-package/          @adatechnology/nestjs-package (published to npm)
│   └── example/                 Example NestJS app (development only)
│
└── frontend/
    └── logger-client/           @adatechnology/logger-client (isomorphic, published to npm)
```

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
- Semver: `packages/backend/{package}/package.json`
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

### Backend NestJS Library
```bash
cd packages/backend
# Copy template from existing library
cp -r nestjs-logger nestjs-my-lib
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

## Troubleshooting

### "no matching version found" during `pnpm install`
→ Check `package.json` workspace protocol: `workspace:*` means "use current version locally"

### "Multiple versions of package X"
→ Run `pnpm install` from monorepo root (not subdirectory)

### "TS1272: A type referenced in a decorated signature must be imported with 'import type'"
→ Use `import type` for all parameter/return types on methods with `@TraceMethod()`

### Build succeeds but types missing in dist/
→ Verify `package.json` has `"types": "dist/index.d.ts"` and build script includes `--dts`
