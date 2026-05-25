# Keycloak (example)

This folder contains a minimal Docker Compose that runs a Keycloak server and imports a basic realm for testing the local `@adatechnology/auth-keycloak` package.

Files:

- `docker-compose.yml` — runs Keycloak and imports JSON files placed in `keycloak-config/`.
- `keycloak-config/example-realm.json` — minimal realm named `example` with one public client `example-client` and a user `test` (password `test`).

## Subir o ambiente

```bash
# from the `example/` folder
# Copy `.env.example` to `.env` to override defaults (recommended)
docker compose up -d

# Keycloak admin console:
# URL: http://localhost:9090  (or the value of KEYCLOAK_PORT in .env)
# Username: admin  /  Password: admin
```

Override host port:

```bash
KEYCLOAK_PORT=9080 docker compose up -d
```

## Testes diretos no Keycloak (curl)

Substituir `localhost:9090` pelo valor de `KEYCLOAK_PORT` se alterado.

### Obter token (password grant)

```bash
curl -s -X POST "http://localhost:9090/realms/example/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=example-client" \
  -d "username=test" \
  -d "password=test" \
  -d "grant_type=password" | jq
```

### Userinfo

```bash
curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" \
  "http://localhost:9090/realms/example/protocol/openid-connect/userinfo" | jq
```

### Introspecção (validar token)

```bash
curl -s -X POST "http://localhost:9090/realms/example/protocol/openid-connect/token/introspect" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=example-client" \
  -d "token=<ACCESS_TOKEN>" | jq
```

### Renovar token

```bash
curl -s -X POST "http://localhost:9090/realms/example/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=example-client" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=<REFRESH_TOKEN>" | jq
```

### Descoberta OpenID Connect

```bash
curl -s "http://localhost:9090/realms/example/.well-known/openid-configuration" | jq
```

---

## Testes via API do example (http://localhost:3000)

Inicie a aplicação (na pasta `example/`):

```bash
pnpm install && pnpm run start:dev
```

### GET /keycloak/token — obtém access token (via client_credentials ou cache)

```bash
TOKEN=$(curl -s "http://localhost:3000/keycloak/token" | jq -r .access_token)
echo "$TOKEN"
```

### POST /keycloak/login — login com username/password

```bash
curl -s -X POST "http://localhost:3000/keycloak/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' | jq
```

### GET /keycloak/userinfo — claims do usuário

```bash
curl -s "http://localhost:3000/keycloak/userinfo?token=$TOKEN" | jq
```

### GET /keycloak/validate — validar token via introspecção

```bash
curl -s "http://localhost:3000/keycloak/validate?token=$TOKEN" | jq
# → { "valid": true }
```

### POST /keycloak/refresh — renovar token

```bash
REFRESH_TOKEN="<valor do refresh_token>"
curl -s -X POST "http://localhost:3000/keycloak/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}" | jq
```

### GET /keycloak/clear-cache — limpar cache do access token

```bash
curl -s "http://localhost:3000/keycloak/clear-cache"
# → { "cleared": true }
# A próxima chamada a /keycloak/token fará uma nova requisição ao Keycloak.
```

---

## Cache de token

O `KeycloakClient` usa `@adatechnology/cache` para armazenar o access token.
Por padrão usa `InMemoryCacheProvider`. Para usar Redis, registre `CacheModule.forRoot({ type: 'redis', ... })`
**antes** do `KeycloakModule` no `AppModule` — o `KeycloakModule` injetará o `CACHE_PROVIDER` automaticamente.

Fluxo de cache:

```
GET /keycloak/token
  → KeycloakDemoController.token            (loga: logContext)
    → KeycloakClient.getAccessToken         (lê logContext do AsyncLocalStorage)
      → InMemoryCacheProvider.get           (loga: cache miss/hit + logContext)
      → KeycloakClient.requestToken         (requisição HTTP ao Keycloak)
      → InMemoryCacheProvider.set           (armazena token com TTL)
```

---

## Propagação de contexto de log

O controller usa `runWithContext` para propagar `logContext` via `AsyncLocalStorage`.
Todas as libs downstream (keycloak, cache) leem esse contexto automaticamente:

```ts
private withCtx<T>(logContext: object, fn: () => Promise<T>): Promise<T> {
  return runWithContext({ ...(getContext() ?? {}), logContext }, fn);
}

@Get('token')
async token() {
  const logContext = { className: KeycloakDemoController.name, methodName: 'token' };
  return this.withCtx(logContext, () => this.svc.getAccessToken());
}
```

Resultado no log:

```
[KeycloakDemoController.token][KeycloakClient.getAccessToken] Cache miss
[KeycloakDemoController.token][KeycloakClient.requestToken]  HTTP POST /token
[KeycloakDemoController.token][InMemoryCacheProvider.set]    Cache set: keycloak:access_token
```

---

## Endpoints de autorização com roles

```bash
TOKEN=$(curl -s "http://localhost:3000/keycloak/token" | jq -r .access_token)

# Rota pública (qualquer token válido)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/keycloak/secure/public

# Rota admin (role 'admin' necessária → 403 se não tiver)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/keycloak/secure/admin

# Verificar se token foi enviado
curl "http://localhost:3000/keycloak/secure/whoami?token=$TOKEN"
```

O `RolesGuard` extrai roles de `realm_access.roles` e `resource_access[clientId].roles` do JWT.

---

## Troubleshooting

- **Realm não encontrado**: verifique se outro Keycloak está em `localhost:8080`. Use `KEYCLOAK_PORT` no `.env`.
- **Token expirado no cache**: use `GET /keycloak/clear-cache` para forçar nova requisição.
- Para forçar re-importação do realm:

```bash
docker compose down -v && docker compose up -d
docker compose logs keycloak --tail=200
```
