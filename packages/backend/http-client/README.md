# @adatechnology/http-client

Fetch wrapper with automatic retry, timeout, and tracing headers (`x-request-id`, `x-trace-id`) from `@adatechnology/logger` context.

## Install

```bash
bun add @adatechnology/http-client @adatechnology/logger
```

## Quick Start

```ts
import { HttpClient } from '@adatechnology/http-client'
import { createLogger, runWithContext, createContext } from '@adatechnology/logger'

const logger = createLogger({ projectName: 'api', version: '1.0.0' })
const client = new HttpClient({ baseUrl: 'https://api.example.com', timeoutMs: 5000, retries: 2 })

// With tracing (automatic x-request-id / x-trace-id)
runWithContext(createContext({ requestId: 'req-1' }), async () => {
  const res = await client.get('/users')
  logger.info('Fetched users', { count: res.data.length })
})
```

## API

### `new HttpClient(opts?)`

| Option | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | `''` | Prefix for relative paths |
| `timeoutMs` | `number` | `30000` | Request timeout |
| `retries` | `number` | `0` | Retry count (on 5xx or network errors) |
| `retryDelayMs` | `number` | `500` | Base delay between retries |
| `headers` | `Record<string, string>` | `{}` | Default headers |

### Methods

- `get<T>(path, opts?)` → `HttpResponse<T>`
- `post<T>(path, body?, opts?)` → `HttpResponse<T>`
- `put<T>(path, body?, opts?)` → `HttpResponse<T>`
- `patch<T>(path, body?, opts?)` → `HttpResponse<T>`
- `delete<T>(path, opts?)` → `HttpResponse<T>`

### `HttpResponse<T>`

```ts
{ status: number; data: T; headers: Headers }
```

### `HttpError`

```ts
throw new HttpError(message, status, data)
```
