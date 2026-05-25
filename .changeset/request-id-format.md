---
"@adatechnology/nestjs-logger": minor
---

feat: configurable requestId format in RequestContextMiddleware

Adiciona `requestIdFormat` ao `LoggerConfig` para controlar o formato do requestId
gerado automaticamente quando a requisição não traz o header `x-request-id`.

Formatos disponíveis:
- `'short-hash'` (padrão): 12 chars hex — ex: `a1b2c3d4e5f6`
  Mesmo formato dos git short hashes — compacto, legível em Loki, correlacionável com Jaeger
- `'uuid'`: UUID v4 completo — ex: `550e8400-e29b-41d4-a716-446655440000`

Exemplo de configuração:
```ts
LoggerModule.forRoot({
  requestIdFormat: 'short-hash', // default
})
```

O `RequestContextMiddleware` agora injeta `LOGGER_CONFIG` via `@Optional()`,
portanto não quebra instâncias que não configurem o módulo explicitamente.
