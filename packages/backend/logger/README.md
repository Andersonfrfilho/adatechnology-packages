# @adatechnology/logger

Structured JSON logger with `AsyncLocalStorage` context propagation, hierarchical `TraceStack`, and middleware for uWebSockets.js + Bun HTTP.

## Install

```bash
bun add @adatechnology/logger
```

## Quick Start

```ts
import { createLogger, runWithContext, createContext, traceMethod } from '@adatechnology/logger'

const logger = createLogger({ projectName: 'my-api', version: '1.0.0' })

// Per-request context
const ctx = createContext({ requestId: crypto.randomUUID() })
runWithContext(ctx, () => {
  logger.info('Request started', { path: '/users' })
  // [2026-...] [INFO] [req-abc123][my-api:1.0.0] Request started
})
```

## API

### `createLogger(config)`

| Option | Type | Default | Description |
|---|---|---|---|
| `projectName` | `string` | required | App name in log prefix |
| `version` | `string` | required | Version in log prefix |
| `logLevel` | `'debug'\|'info'\|'warn'\|'error'` | `'info'` | Minimum level |
| `pretty` | `boolean` | `false` | Human-readable output |
| `fileTransport` | `string` | — | File path for persistent logs |

### `Logger`

- `debug(msg, meta?)` / `info(msg, meta?)` / `warn(msg, meta?)` / `error(msg, meta?)`

### Context

- `createContext(partial?)` — Create context with `requestId`, `traceId`, `stack`
- `runWithContext(ctx, fn)` — Execute function with context
- `getContext()` — Get current context (or undefined)
- `getContextOrThrow()` — Get or throw

### TraceStack

- `pushToTraceStack(label)` / `popFromTraceStack()` — Hierarchical call tracing
- `traceMethod(tag, fn)` — Wrap a function with automatic push/pop
- `getTraceStack()` — Current stack array
- `buildPrefix()` — Built prefix string for the current context

### Middleware

- `createUwsMiddleware(config)` — uWS-compatible middleware (extracts `x-request-id`, `x-trace-id`)
- `createHttpHandler(handler, logger)` — Bun.serve HTTP handler wrapper with auto logging + response headers

## Log Output

```json
{
  "timestamp": "2026-01-01T00:00:00.000Z",
  "level": "INFO",
  "requestId": "req-abc123",
  "traceId": "trace-xyz",
  "message": "[req-abc1][my-api:1.0.0][UserService.create] User created",
  "meta": { "userId": 42 }
}
```
