# CLAUDE.md — @adatechnology/catalog-module

## Propósito

Gerenciamento de catálogo e produtos: CRUD, seções, estoque, importação em lote e publicação
**opcional** na Meta Commerce. `pgSchema('catalog')`, journal `catalog_migrations`.

Spec: `.specs/features/catalog-trio/spec.md`.

## Entrypoints

| Import | Traz | Peer |
|---|---|---|
| `.` | schema, migrations, repositories, use-cases, `createCatalogModule` | `drizzle-orm` |
| `./http/fetch` | adaptador WHATWG (Bun.serve, Hono, router próprio) | — |
| `./http/uws` | adaptador uWebSockets.js | `uWebSockets.js` |
| `./openapi` | paths OpenAPI derivados da tabela de rotas | — |

O encanamento HTTP vem do `@adatechnology/module-http`, compartilhado com os outros módulos
plugáveis — este pacote só declara a tabela de rotas.

## A Meta é opcional, e o módulo prova isso

`DEFAULT_META_SYNC` é `{ products: false, catalogs: false }`. Com sync desligado:

- as **rotas de publicação não são montadas** — não é botão escondido, a rota não existe;
- `createCatalogModule` **não exige** `MetaCatalogSyncPort`;
- nenhuma coluna de sync é escrita.

Ligar `metaSync` sem injetar a porta **falha no boot** — o operador descobriria pelo item que
nunca sobe, dias depois.

O módulo **não importa** o `meta-catalog-provider`: a publicação entra por porta, e o adaptador
sobre o SDK da Meta é escrito no host.

## Sem fila, e é decisão

O `notification-module` usa fila porque entrega é por evento, sensível a latência e de volume
alto. Catálogo é o oposto: muda quando um operador edita, tolera minutos de atraso e ganha com
lote. Uma **varredura por cron** sobre `syncStatus = 'pending'` cobre o caso, recupera sozinha o
que um enfileiramento perderia, e evita exigir broker de quem só quer publicar produto.

O `retriable` volta para `pending` sem backoff explícito — **o intervalo do cron é o backoff**.

```ts
for (const schedule of catalog.schedules) {
  cron.register(schedule.name, schedule.cronExpression, () => schedule.run(companyId))
}
```

`schedules[].run` recebe `companyId` porque o módulo não conhece a lista de empresas do host.

## Estoque é atômico

`ConsumeInventory` desce até um `UPDATE ... WHERE inventory >= quantity` com checagem de linhas
afetadas. Read-then-write deixaria dois pedidos simultâneos do último item lerem o mesmo saldo e
ambos passarem — o banco é o único lugar onde essa corrida se resolve sem lock explícito.

Há teste de concorrência: dois consumos simultâneos do último item, um falha; dez concorrentes
com estoque 3, exatamente 3 passam.

## Custo não vaza

`CUSTOMER_FACING_PRODUCT_COLUMNS` é lista **explícita**, não `omit`: coluna nova nasce fora da
projeção do cliente por padrão. Esquecer de excluir vaza margem; esquecer de incluir só some da
tela — os dois erros não têm o mesmo peso. O `lookup` que o canal de conversa consome usa essa
projeção.

## Comandos

```bash
pnpm --filter @adatechnology/catalog-module run check
pnpm --filter @adatechnology/catalog-module run test
pnpm --filter @adatechnology/catalog-module run build
pnpm --filter @adatechnology/catalog-module run db:generate
```
