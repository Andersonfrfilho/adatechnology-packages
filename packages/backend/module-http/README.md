# @adatechnology/module-http

Camada HTTP compartilhada pelos módulos plugáveis. **Rota é dado, não código**: o módulo declara
uma tabela sem nenhum tipo de framework, e dela saem três consumidores que por construção não
divergem — adaptador `fetch`, adaptador uWebSockets e paths OpenAPI.

Nasceu extraído do `notification-module` quando o `catalog-module` precisou do mesmo encanamento.

## Instalação

```bash
bun add @adatechnology/module-http
```

`uWebSockets.js` é peer **opcional** — só quem importa `/uws` precisa dele.

## Declarar rotas

```ts
import type { ModuleRoute } from '@adatechnology/module-http'

const routes: ModuleRoute[] = [
  {
    method: 'GET',
    path: '/products/:id',
    scope: 'admin',
    operationId: 'getProduct',
    summary: 'Detalhe de um produto',
    async handler(context) {
      const product = await getProduct(context.auth!.companyId, context.params.id!)
      return { kind: 'json', status: 200, body: { data: product } }
    },
  },
]
```

## Montar

```ts
// Bun.serve, Hono, router próprio
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'
const http = createModuleFetchRouter({ routes, basePath: '/v1', authResolver })
if (http.match(request)) return http.handle(request)

// uWebSockets.js
import { mountModuleRoutes } from '@adatechnology/module-http/uws'
mountModuleRoutes({ app, routes, basePath: '/v1', authResolver })
```

## O que o despachante faz por você

Casa a rota, valida `body`/`query` com zod, resolve identidade, checa escopo, chama o handler e
converte exceção em resposta. **Os adaptadores só traduzem transporte** — é o que torna o teste de
contrato compartilhado possível e impede os dois de divergirem.

- `401` sem identidade, `403` com identidade e sem escopo — a distinção diz ao cliente se ele faz
  login ou pede acesso
- `ZodError` vira `400` com **todos** os problemas de uma vez
- Erro desconhecido vira `500` genérico, sem stack para o cliente
- `details` do erro de domínio fica no log, nunca na resposta

Erro de domínio é reconhecido pela **forma** (`{ statusCode, code, message }`), não por `instanceof`
— cada módulo tem hierarquia autocontida, e checar por herança inverteria a direção da dependência.

## SSE

```ts
return {
  kind: 'stream',
  heartbeatSeconds: 25,
  async subscribe(emit) {
    emit({ event: 'unread-count', data: JSON.stringify({ count }) })
    return { close: () => {} }
  },
}
```

⚠️ **O `idleTimeout` do `Bun.serve` precisa ser MAIOR que o heartbeat.** Menor, a conexão morre
antes do primeiro batimento e a tela mostra dado velho sem erro nenhum.

## Armadilhas do uWS que o adaptador encapsula

1. `res` fica inválido após o abort — `onAborted` marca a flag antes de qualquer escrita assíncrona
2. Todo `req` é lido **síncrono**, antes do primeiro `await`; depois o objeto é reciclado
3. O `ArrayBuffer` do `onData` é reaproveitado no chunk seguinte — daí a cópia
4. Escrita fora de `cork()` gera um pacote de rede por chamada

## Testar os dois adaptadores

```ts
import { createUwsHarness } from '@adatechnology/module-http/testing'
```

Dublê do uWS que não exige o addon instalado.

## Licença

MIT © Ada Technology
