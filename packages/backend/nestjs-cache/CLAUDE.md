# CLAUDE.md — @adatechnology/cache

## Propósito

Provider de cache Redis/InMemory com suporte a criptografia AES-256. Integrado com o logger para debug de operações.

## Uso

```ts
import { CacheModule } from '@adatechnology/cache';

CacheModule.forRoot({
  encryptionSecret: process.env.CACHE_ENCRYPTION_SECRET,  // mín. 16 chars
  excludedDebugKeys: ['health:*', 'metrics:*'],           // oculta do log de debug
})
```

## Token de Injeção

```ts
import { CACHE_PROVIDER } from '@adatechnology/cache';

constructor(@Inject(CACHE_PROVIDER) private readonly cache: CacheProviderInterface) {}
```

## Interface do Provider

```ts
interface CacheProviderInterface {
  get<T>(params: GetParams): Promise<T | null>;
  set<T>(params: SetParams<T>): Promise<void>;
  del(params: DelParams): Promise<void>;
  setEncrypted<T>(params: SetEncryptedParams<T>): Promise<void>;
  getEncrypted<T>(params: GetEncryptedParams): Promise<T | null>;
}
```

## Logs automáticos

A lib loga automaticamente com `lib: '@adatechnology/cache'` e `libMethod: 'CacheProvider.get'` etc., aparecendo no traceStack quando `enableTraceStack: true`.

## Providers disponíveis

| Env | Provider |
|---|---|
| `REDIS_URL` definido | Redis (ioredis) |
| Sem `REDIS_URL` | InMemory (Map) |

## Adicionando ao cache

Todas as operações de chave devem usar constantes:
```ts
// cache.constants.ts
export const CACHE_KEYS = {
  USER_BY_ID: (id: string) => `user:${id}`,
  USER_BY_KEYCLOAK: (keycloakId: string) => `user:keycloak:${keycloakId}`,
} as const;
```
