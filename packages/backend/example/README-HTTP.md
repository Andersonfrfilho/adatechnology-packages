# README HTTP (testes manuais com curl)

Este guia mostra testes manuais para validar os logs adicionados no `example` usando o módulo `@adatechnology/http-client`.

A ideia é você conseguir visualizar no terminal da aplicação:

- log de **request**
- log de **response**
- log de **error**
- `source` (classe/método)
- `requestId`

> Observação: no `example`, o logging do HTTP está habilitado para ambientes `development` e `test`.
>
> O `requestId` também está com geração automática habilitada quando o header `x-request-id` não é enviado.

## Responsabilidade do requestId (recomendado)

- A aplicação (camada de entrada HTTP) deve ser a fonte de verdade do `requestId`.
- O `http-client` deve propagar esse valor nas chamadas externas e nos próprios logs.
- A geração automática no `http-client` serve como fallback para não ficar sem correlação.

Na prática:

1. middleware/interceptor do app lê `x-request-id` (ou gera);
2. logger do app usa esse mesmo `requestId`;
3. `http-client` usa esse mesmo `requestId` no header e nos logs.

## Decorator disponível na lib: `@UseHttpRequestId()`

O `@adatechnology/http-client` agora disponibiliza o decorator `UseHttpRequestId`.

- Em **controller**: aplica para todas as rotas do controller.
- Em **método**: aplica somente para a rota específica.

Exemplo no `example`:

```ts
import { UseHttpRequestId } from '@adatechnology/http-client';

@Controller('http-client')
@UseHttpRequestId()
export class HttpClientController {}
```

Exemplo em rota específica:

```ts
@Get('pokemon/:id')
@UseHttpRequestId()
async getOne() {}
```

## 1) Pré-requisitos

- Dependências instaladas no monorepo.
- Arquivo `.env` na raiz (já criado) com pelo menos:
  - `PORT=3000`
  - `LOG_LEVEL=info`

## 2) Subir a aplicação example

Na raiz do monorepo:

```bash
pnpm --filter example start:dev
```

Se subir com sucesso, a API ficará disponível em `http://localhost:3000`.

---

## 3) Teste de request + response (sem requestId)

```bash
curl -i http://localhost:3000/http-client/pokemon
```

### O que você deve ver nos logs

- Um log com `HTTP:REQUEST`
- Um log com `HTTP:RESPONSE`
- `source` parecido com `HttpClientController.listPokemon`
- Em `GET`, o `data` da **request** tende a vir `undefined` (normal)
- Com a configuração atual do `example`, o `data` da **response** deve vir preenchido

---

## 4) Teste com requestId explícito

```bash
curl -i \
  -H "x-request-id: req-manual-001" \
  http://localhost:3000/http-client/pokemon/1/with-request-id
```

### O que você deve ver nos logs

- `HTTP:REQUEST` e `HTTP:RESPONSE`
- `source` parecido com `HttpClientController.getOneWithRequestId`
- `requestId: req-manual-001`

Se você não enviar o header, o `@UseHttpRequestId()` do controller garante geração/propagação automática.

Teste rápido sem header:

```bash
curl -i http://localhost:3000/http-client/pokemon/1/with-request-id
```

---

## 5) Teste de erro HTTP (para validar log de error)

Use um id inválido para forçar erro na API externa:

```bash
curl -i http://localhost:3000/http-client/pokemon/abc/with-request-id
```

Para validar **erro + requestId explícito** no mesmo teste, envie o header:

```bash
curl -i \
  -H "x-request-id: req-manual-erro-001" \
  http://localhost:3000/http-client/pokemon/abc/with-request-id
```

> Se não gerar erro com esse valor, tente um valor improvável (ex.: `999999999`).

### O que você deve ver nos logs

- `HTTP:REQUEST`
- `HTTP:ERROR`
- Campos como `status`, `message` e possivelmente `responseData` (dependendo da resposta upstream)
- `requestId` vindo do header quando enviado, ou gerado automaticamente quando ausente

---

## 6) Inspecionar exemplos de código expostos pelo endpoint

```bash
curl -s http://localhost:3000/http-client/code-samples
```

Esse endpoint retorna snippets de configuração do `HttpModule.forRoot`, interceptors e `logContext`.

---

## 7) Request genérico (`request`) e reativo (`request$`)

### request (Promise)

```bash
curl -i http://localhost:3000/http-client/request-generic
```

### request$ (Observable)

```bash
curl -i http://localhost:3000/http-client/request-observable
```

Nos dois casos, você deve ver logs de `HTTP:REQUEST` e `HTTP:RESPONSE`.

### Demo do decorator no controller e no método

```bash
# decorator aplicado no controller inteiro
curl -i http://localhost:3000/http-client/demo/decorator-controller

# decorator aplicado explicitamente no método
curl -i http://localhost:3000/http-client/demo/decorator-method
```

Nos dois casos, você deve ver `requestId` no prefixo dos logs do `http-client`.

---

## 8) Headers globais

> Importante: os endpoints abaixo apenas leem/escrevem configuração interna do client.
> Eles **não fazem chamada HTTP externa**, então é esperado que **não apareça** `HTTP:REQUEST/RESPONSE` nesse momento.

### Definir header global

```bash
curl -i -X POST http://localhost:3000/http-client/set-global-header \
  -H "content-type: application/json" \
  -d '{"key":"X-Tenant-Id","value":"tenant-01"}'
```

### Listar headers globais

```bash
curl -s http://localhost:3000/http-client/global-headers
```

Para validar esses headers nos logs, faça uma chamada HTTP externa depois de configurar:

```bash
curl -i http://localhost:3000/http-client/pokemon
```

No log `request`, você deve ver o header global (ex.: `X-Tenant-Id`/`x-tenant-id`) sendo enviado.

### Remover header global

```bash
curl -i -X POST http://localhost:3000/http-client/remove-global-header \
  -H "content-type: application/json" \
  -d '{"key":"X-Tenant-Id"}'
```

---

## 9) Timeout e Base URL

### Ler base URL atual

```bash
curl -s http://localhost:3000/http-client/get-base-url
```

### Alterar timeout padrão

```bash
curl -i -X POST http://localhost:3000/http-client/set-timeout \
  -H "content-type: application/json" \
  -d '{"timeout":1500}'
```

---

## 10) Error interceptor

### Adicionar interceptor de erro

```bash
curl -i -X POST http://localhost:3000/http-client/add-error-interceptor
```

### Forçar erro para acionar interceptor

```bash
curl -i http://localhost:3000/http-client/pokemon/abc/with-request-id
```

### Remover interceptor de erro

```bash
curl -i -X POST http://localhost:3000/http-client/remove-error-interceptor
```

---

## 11) Cache e limpeza de cache

### Rodar demo de cache

```bash
curl -s http://localhost:3000/http-client/cache-demo
```

### Limpar cache inteiro

```bash
curl -i -X POST http://localhost:3000/http-client/clear-cache
```

---

## 12) Dicas de diagnóstico

### Teste manual de correlação (app + http-client)

Objetivo: validar que logs da aplicação e logs do `http-client` compartilham o mesmo `requestId`.

```bash
curl -i -H "x-request-id: req-correlation-001" http://localhost:3000/http-client/pokemon/1/with-request-id
```

No terminal, você deve procurar o mesmo `req-correlation-001` em:

- logs de aplicação (seus serviços/controllers)
- logs do `http-client` (`request`/`response`/`error`)

### Não apareceu log?

1. Confira se você subiu com `start:dev`.
2. Verifique se `NODE_ENV` está em `development` ou `test`.
3. Verifique se o módulo HTTP está configurado com logging habilitado no arquivo:
   - `example/src/http-client/http-client.module.ts`

### Logs sem requestId

- No endpoint com request id, envie o header `x-request-id`.
- Exemplo:

```bash
curl -i -H "x-request-id: req-xyz-123" http://localhost:3000/http-client/pokemon/1/with-request-id
```

### Decorator na lib (já disponível)

A lib já disponibiliza um decorator para uso em rota específica ou controller inteiro, por exemplo:

- `@UseHttpRequestId()` em método
- `@UseHttpRequestId()` no controller

Esse decorator pode forçar/propagar o `requestId` para chamadas do `http-client` automaticamente.
Mesmo assim, a recomendação continua sendo manter o app como dono do `requestId` (governança central de correlação).

---

## 13) Resumo rápido de comandos

```bash
# subir app
pnpm --filter example start:dev

# request + response
curl -i http://localhost:3000/http-client/pokemon

# request + response + requestId
curl -i -H "x-request-id: req-manual-001" http://localhost:3000/http-client/pokemon/1/with-request-id

# correlação app + http-client
curl -i -H "x-request-id: req-correlation-001" http://localhost:3000/http-client/pokemon/1/with-request-id

# erro
curl -i http://localhost:3000/http-client/pokemon/abc/with-request-id

# erro + requestId explícito
curl -i -H "x-request-id: req-manual-erro-001" http://localhost:3000/http-client/pokemon/abc/with-request-id

# snippets
curl -s http://localhost:3000/http-client/code-samples

# request genérico / request$
curl -i http://localhost:3000/http-client/request-generic
curl -i http://localhost:3000/http-client/request-observable

# headers globais
curl -i -X POST http://localhost:3000/http-client/set-global-header -H "content-type: application/json" -d '{"key":"X-Tenant-Id","value":"tenant-01"}'
curl -s http://localhost:3000/http-client/global-headers
curl -i -X POST http://localhost:3000/http-client/remove-global-header -H "content-type: application/json" -d '{"key":"X-Tenant-Id"}'

# timeout e baseURL
curl -s http://localhost:3000/http-client/get-base-url
curl -i -X POST http://localhost:3000/http-client/set-timeout -H "content-type: application/json" -d '{"timeout":1500}'

# error interceptor
curl -i -X POST http://localhost:3000/http-client/add-error-interceptor
curl -i http://localhost:3000/http-client/pokemon/abc/with-request-id
curl -i -X POST http://localhost:3000/http-client/remove-error-interceptor

# cache
curl -s http://localhost:3000/http-client/cache-demo
curl -i -X POST http://localhost:3000/http-client/clear-cache
```
