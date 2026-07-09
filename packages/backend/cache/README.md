# @adatechnology/cache

In-memory cache with TTL expiration, maxSize eviction, and automatic cleanup. Works in Bun and Node.js.

## Install

```bash
bun add @adatechnology/cache
```

## Quick Start

```ts
import { Cache } from '@adatechnology/cache'

const cache = new Cache<string>({ ttlMs: 30_000, maxSize: 100 })

cache.set('user:1', JSON.stringify({ name: 'Alice' }))
const user = cache.get('user:1') // valid for 30s
```

## API

### `new Cache<T>(opts?)`

| Option | Type | Default | Description |
|---|---|---|---|
| `ttlMs` | `number` | `60000` | Default TTL in ms |
| `maxSize` | `number` | `Infinity` | Max entries (evicts oldest) |

### Methods

| Method | Returns | Description |
|---|---|---|
| `get(key)` | `T \| undefined` | Get value (undefined if expired or missing) |
| `set(key, value, ttlMs?)` | `void` | Set value with optional per-key TTL |
| `delete(key)` | `boolean` | Remove key |
| `has(key)` | `boolean` | Check existence (expired = false) |
| `keys()` | `string[]` | All valid keys |
| `size()` | `number` | Count of valid entries |
| `cleanup()` | `number` | Remove expired entries (auto: every 60s) |
| `clear()` | `void` | Remove all entries |
| `destroy()` | `void` | Stop auto-cleanup, clear store |
