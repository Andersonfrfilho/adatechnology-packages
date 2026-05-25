# Cache Demo (example)

Demonstrates direct usage of `@adatechnology/cache` in a NestJS application.

## Setup no AppModule

```ts
import { CacheModule } from '@adatechnology/cache';

@Module({
  imports: [
    CacheModule.forRoot({
      // optional — required only for setEncrypted/getEncrypted
      encryptionSecret: process.env.CACHE_ENCRYPTION_SECRET,
    }),
    // KeycloakModule automatically uses CACHE_PROVIDER for token storage
    KeycloakModule.forRoot({ ... }),
  ],
})
export class AppModule {}
```

`CacheModule.forRoot()` é global por padrão — registra `CACHE_PROVIDER` (InMemoryCacheProvider) disponível em toda a aplicação.

## Injeção em services/controllers

```ts
import { Inject } from '@nestjs/common';
import { CACHE_PROVIDER } from '@adatechnology/cache';
import type { CacheProviderInterface } from '@adatechnology/cache';

constructor(
  @Inject(CACHE_PROVIDER) private readonly cache: CacheProviderInterface,
) {}
```

## Endpoints de demonstração (http://localhost:3000)

### GET /cache-demo/demo — fluxo completo (set → get → del → get)

```bash
curl -s "http://localhost:3000/cache-demo/demo" | jq
# → { beforeSet: { hit: false }, afterSet: { hit: true, value: {...} }, afterDel: { hit: false } }
```

### GET /cache-demo/demo-encrypted — AES-256-GCM

```bash
curl -s "http://localhost:3000/cache-demo/demo-encrypted" | jq
# → { stored: {...}, retrieved: {...}, match: true }
```

### GET /cache-demo/set?key=foo&value=bar&ttl=60 — armazenar valor

```bash
curl -s "http://localhost:3000/cache-demo/set?key=minha-chave&value=meu-valor&ttl=60" | jq
```

### GET /cache-demo/get?key=foo — recuperar valor

```bash
curl -s "http://localhost:3000/cache-demo/get?key=minha-chave" | jq
# → { key: "minha-chave", value: "meu-valor", hit: true }
```

### DELETE /cache-demo/del?key=foo — remover chave

```bash
curl -s -X DELETE "http://localhost:3000/cache-demo/del?key=minha-chave" | jq
```

### POST /cache-demo/set-encrypted — armazenar criptografado

```bash
curl -s -X POST "http://localhost:3000/cache-demo/set-encrypted" \
  -H "Content-Type: application/json" \
  -d '{"key":"secret-key","value":{"token":"abc123","userId":"user-1"},"ttl":120}' | jq
```

### GET /cache-demo/get-encrypted?key=foo — recuperar e decifrar

```bash
curl -s "http://localhost:3000/cache-demo/get-encrypted?key=secret-key" | jq
# → { key: "secret-key", value: { token: "abc123", userId: "user-1" }, hit: true }
```

## Propagação de contexto de log

O controller usa `runWithContext` para propagar `logContext` via `AsyncLocalStorage`.
Os logs do `InMemoryCacheProvider` automaticamente exibem o método originador:

```
[CacheDemoController.demo][InMemoryCacheProvider.get]  Cache miss: demo:example-key
[CacheDemoController.demo][InMemoryCacheProvider.set]  Cache set: demo:example-key
[CacheDemoController.demo][InMemoryCacheProvider.get]  Cache hit: demo:example-key
[CacheDemoController.demo][InMemoryCacheProvider.del]  Cache del: demo:example-key
[CacheDemoController.demo][InMemoryCacheProvider.get]  Cache miss: demo:example-key
```

## Integração com Keycloak

Quando `CacheModule.forRoot()` está registrado **antes** do `KeycloakModule`, o `KeycloakClient`
injeta automaticamente o `CACHE_PROVIDER` para armazenar o access token. A propagação de log
funciona da mesma forma:

```
[KeycloakDemoController.token][KeycloakClient.getAccessToken] Cache miss
[KeycloakDemoController.token][KeycloakClient.requestToken]   HTTP POST → Keycloak
[KeycloakDemoController.token][InMemoryCacheProvider.set]     Cache set: keycloak:access_token
```

Na segunda chamada:

```
[KeycloakDemoController.token][KeycloakClient.getAccessToken] Returning cached token
[KeycloakDemoController.token][InMemoryCacheProvider.get]     Cache hit: keycloak:access_token
```

## Implementações disponíveis

| Classe | Descrição |
|---|---|
| `InMemoryCacheProvider` | Cache em memória (padrão). Sem dependências externas. |
| `RedisCacheProvider` | Cache Redis via `ioredis`. Instanciado manualmente com `new RedisCacheProvider(options, logger?)`. |

Para usar Redis como provider global:

```ts
import { RedisCacheProvider } from '@adatechnology/cache';
import { CACHE_PROVIDER } from '@adatechnology/cache';

// No módulo (sem CacheModule.forRoot)
providers: [
  {
    provide: CACHE_PROVIDER,
    useFactory: (logger) => new RedisCacheProvider({ host: 'localhost', port: 6379 }, logger),
    inject: [{ token: LOGGER_PROVIDER, optional: true }],
  },
],
```
