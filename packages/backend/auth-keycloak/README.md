# @adatechnology/auth-keycloak

Keycloak JWT verification with automatic JWKS fetch + cache, and HTTP middleware for Bun.

## Install

```bash
bun add @adatechnology/auth-keycloak
```

## Quick Start

```ts
import { verifyToken, createKeycloakMiddleware } from '@adatechnology/auth-keycloak'

const config = {
  realm: 'my-realm',
  authServerUrl: 'https://auth.example.com/auth',
  clientId: 'my-app',
}

// Verify a token
const result = await verifyToken('eyJhbGci...', config)
if (result.valid) {
  console.log('User:', result.user?.email, result.user?.realmRoles)
}

// Middleware for Bun HTTP server
const middleware = createKeycloakMiddleware(config)
Bun.serve({
  async fetch(req) {
    const blocked = await middleware.handler(req)
    if (blocked) return blocked // 401
    // ... handle authenticated request
  }
})
```

## API

### `verifyToken(token, config)` → `TokenValidationResult`

Fetches JWKS from `{authServerUrl}/realms/{realm}/protocol/openid-connect/certs` (cached 5min). Validates signature, `exp`, `nbf`, `iss`.

### `createKeycloakMiddleware(config)` → `{ handler, getUser }`

- `handler(req: Request)` → `Promise<Response | null>` — `null` = authenticated, `Response` = 401
- `getUser(req: Request)` → `KeycloakUser | undefined` — stored via `WeakMap`

### Types

```ts
interface KeycloakConfig {
  realm: string
  authServerUrl: string
  clientId: string
  clientSecret?: string
}

interface KeycloakUser {
  sub: string
  email?: string
  username?: string
  name?: string
  realmRoles: string[]
  clientRoles: Record<string, string[]>
}
```
