# @adatechnology/stock-module

Estoque **opcional**, ligado por empresa: saldo por insumo com **mínimo** e aviso, **lotes com validade** e varredura
diária, **movimentos** (entrada, saída, ajuste, perda) com motivo e autor, **baixa por pedido através da ficha técnica**
(idempotente por linha) e **inventário**. Tabelas no schema Postgres `stock`, journal próprio (`stock_migrations`).

Não tem cadastro de insumo nem ficha: os dois vêm do [`recipe-module`](../recipe-module) (ou do host) por portas no
mesmo formato. Em troca, `useCases.getLevels` é o `StockLevelPort` que o `recipe-module` usa para descontar o estoque
da lista de compras.

## Ligando com o recipe-module

```ts
import { createRecipeModule } from '@adatechnology/recipe-module'
import { createStockModule, createStockRoutes, runStockMigrations, type StockModule } from '@adatechnology/stock-module'
import { createModuleFetchRouter } from '@adatechnology/stock-module/http/fetch'

await runStockMigrations({ db, migrate })

// Os dois se referem: a ficha lê o saldo pela porta (só na hora da chamada), o estoque lê insumos e fichas.
let stock: StockModule
const recipes = createRecipeModule({
  db,
  providers: { stockLevels: { getLevels: (params) => stock.useCases.getLevels.getLevels(params) } },
})

stock = createStockModule({
  db,
  config: {
    // Ligado só para quem contratou; desligado = rotas 404, baixa `disabled` e a lista de compras sem desconto.
    isEnabledForCompany: (companyId) => companySettings.hasStock(companyId),
    expiryAlertDays: 7,
  },
  providers: {
    catalog: { findIngredients: (params) => recipes.useCases.findIngredients.execute(params) },
    recipes: { lookup: (params) => recipes.useCases.lookupRecipes.execute(params) },
  },
  hooks: {
    onBelowMinimum: (event) => notifications.send({ template: 'stock-below-minimum', ...event }),
    onBatchesExpiring: ({ companyId, batches }) => notifications.send({ template: 'stock-expiring', companyId, batches }),
  },
})

const stockRouter = createModuleFetchRouter({ routes: createStockRoutes({ module: stock }), basePath: '/v1/stock', authResolver })
```

A porta de catálogo só pede `{ id, name, unit }`; outro cadastro de insumo do host serve igual.

## Baixa por pedido

Chame do backend do host quando o pedido entra em preparo (ou na rota `POST /service/orders/deductions`):

```ts
await stock.useCases.deductOrder.execute({
  companyId,
  actorId: user.id,
  input: { orderId: order.id, lines: order.items.map((item) => ({ lineKey: item.id, productId: item.productId, quantity: String(item.quantity) })) },
})
```

- A chave `order:<orderId>:<lineKey>` entra na tabela `stock.deductions` (PK) na mesma transação dos movimentos: retry,
  reenvio e duas chamadas simultâneas baixam **uma vez**.
- Necessidade pela ficha (`calculateIngredientNeedsExact` do contracts), convertida para a unidade do insumo; sai dos
  lotes que vencem antes (FEFO). O que não couber em lote sai sem lote e o saldo fica negativo, visível no painel —
  o pedido nunca trava por falta de entrada registrada.
- Produto sem ficha volta em `productsWithoutRecipe`. Produto composto (combo): o host expande nos componentes antes.

## Concorrência e integridade

Toda mudança de saldo passa por um único caminho, dentro de transação, com os níveis travados em ordem de id (sem
deadlock entre pedidos) e os lotes travados (`FOR UPDATE`). Banco recusa: saldo de lote negativo ou acima da
quantidade, movimento zero, mínimo negativo, dois inventários abertos (índice parcial). Cada nível guarda a unidade em
que nasceu; a leitura converte se a unidade do insumo mudou entre compatíveis (g ↔ kg).

## Rotas

| Método e caminho | Escopo | O que faz |
|---|---|---|
| `GET /levels?belowMinimum=` · `GET /levels/:ingredientId` | leitura | saldos (abaixo do mínimo primeiro) |
| `PUT /levels/:ingredientId/minimum` | escrita | define ou tira o mínimo |
| `POST /batches` · `GET /batches` | escrita / leitura | entrada de lote (validade e custo opcionais); lotes com saldo, vencendo na janela |
| `POST /adjustments` · `POST /losses` | escrita | ajuste com direção e motivo; perda de um lote ou FEFO |
| `GET /movements` | leitura | histórico por insumo, tipo e período |
| `GET/POST /inventories` · `GET /inventories/:id` · `PUT /inventories/:id/counts` · `POST /inventories/:id/apply` · `POST /inventories/:id/cancel` | leitura / escrita | inventário |
| `POST /service/orders/deductions` · `POST /service/levels/lookup` | serviço | baixa por pedido; saldo em lote |

Escopos padrão `stock:read`, `stock:write`, `stock:service` (configuráveis); empresa sempre do token.

## Job de validade

```ts
// cron diário do host (worker): agrupa por empresa e chama hooks.onBatchesExpiring
await stock.useCases.scanExpiringBatches.execute({ withinDays: 7 })
```

## Testes

`bun test` (dublê em memória com transações em fila e desfeitas por cópia) e, com
`DRIZZLE_TEST_DATABASE_URL`, a integração em Postgres: baixas simultâneas da mesma linha (uma aplica), oito pedidos
simultâneos somando certo, FEFO, índice parcial do inventário e a varredura.
