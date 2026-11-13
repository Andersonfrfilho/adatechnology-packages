# CLAUDE.md — @adatechnology/module-http

## Propósito

Camada HTTP compartilhada pelos módulos plugáveis. **Rota é dado, não código**: o módulo declara
uma `ModuleRouteTable` sem nenhum tipo de framework, e daqui saem três consumidores que por
construção não divergem — adaptador `fetch`, adaptador `uws` e paths OpenAPI.

Extraído do `notification-module` quando o `catalog-module` precisou da mesma coisa (regra do 2º
uso, `pluggable-module.md` §1). Duplicar as ~700 linhas seria o antipadrão da §6.

## Entrypoints

| Import | Traz | Peer |
|---|---|---|
| `.` | tipos, `dispatchRoute`, matcher, filtro de erro | — |
| `./fetch` | `createModuleFetchRouter` — Bun.serve, Hono, router próprio | — |
| `./uws` | `mountModuleRoutes` — uWebSockets.js | `uWebSockets.js` |
| `./openapi` | `moduleOpenApiPaths` | — |
| `./testing` | `createUwsHarness` — dublê do uWS para o teste de contrato | — |

## O núcleo é `dispatchRoute`

Casa a rota, valida body/query com zod, resolve identidade, checa escopo, chama o handler e
converte exceção em resposta. **Os adaptadores só traduzem transporte** — é isso que torna o
teste de contrato compartilhado possível, e o que impede os dois de divergirem.

- 401 sem identidade, 403 com identidade e sem escopo — a distinção diz ao cliente se ele faz
  login ou pede acesso.
- `ZodError` vira 400 com **todos** os problemas de uma vez (`apis.md`).
- Erro desconhecido vira 500 genérico, sem stack para o cliente.
- `details` do erro de domínio **não** vai na resposta: carrega userId, deviceId e afins.

## Erro de domínio por forma, não por herança

`isDomainErrorShape` reconhece `{ statusCode, code, message }`. Cada módulo tem hierarquia própria
e autocontida (`CatalogError`, `NotificationError`) — checar por `instanceof` obrigaria este
pacote a depender do contracts de cada módulo, invertendo a direção da dependência.

## Armadilhas do uWS que o adaptador encapsula

1. `res` fica **inválido** depois do abort — daí `onAborted` marcar flag antes de qualquer escrita
   assíncrona.
2. Todo `req` (headers, url, query) é lido **síncrono**, antes do primeiro `await`; depois disso o
   objeto é reciclado e devolve lixo.
3. O `ArrayBuffer` do `onData` é reaproveitado no chunk seguinte — guardar a referência crua
   corromperia corpo fragmentado, por isso a cópia.
4. Escrita fora de `cork()` gera um pacote de rede por chamada.

## SSE

`heartbeatSeconds` faz parte do contrato do `StreamResult` porque o host precisa dele: **o
`idleTimeout` do `Bun.serve` tem que ser maior que o heartbeat**, senão a conexão morre antes do
primeiro batimento e a tela mostra dado velho sem erro nenhum.

## Comandos

```bash
pnpm --filter @adatechnology/module-http run check
pnpm --filter @adatechnology/module-http run test
pnpm --filter @adatechnology/module-http run build
```
