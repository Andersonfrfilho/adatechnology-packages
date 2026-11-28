---
'@adatechnology/stock-contracts': minor
'@adatechnology/stock-module': minor
'@adatechnology/stock-ui': minor
---

Novo trio de estoque, opcional e ligado por empresa (`isEnabledForCompany`): saldo por insumo com mínimo e aviso uma vez por cruzamento, lotes com validade e custo, varredura de validade para o job do host, movimentos de entrada, saída, ajuste e perda com motivo e autor, baixa por pedido através da ficha técnica (idempotente por linha, primeiro que vence sai primeiro) e inventário com contagem parcial. Insumos e fichas vêm do `recipe-module` por portas; `getLevels` é o `StockLevelPort` dele. Telas `IngredientStockButton`/`IngredientStockPanel`, `StockLevelsWorkspace` e `InventoryWorkspace` sobre as peças do `recipes-ui`. Migration inicial do schema `stock` (journal `stock_migrations`).

Concorrência: toda mudança de saldo numa transação com níveis travados em ordem e lotes `FOR UPDATE`; banco recusa saldo de lote fora do intervalo, movimento zero e dois inventários abertos.
