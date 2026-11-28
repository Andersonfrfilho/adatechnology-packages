# @adatechnology/stock-contracts

Contratos do trio de estoque (opcional): `StockLevelView`, `StockBatch`, `StockMovement` (`in`, `out`, `adjust`,
`loss`), `InventoryCount`, `OrderDeductionResult`; schemas zod (`receiveBatchSchema`, `adjustStockSchema`,
`recordLossSchema`, `deductOrderSchema`, `openInventorySchema`…); erros `StockError`; portas `IngredientCatalogPort` e
`RecipeSourcePort` no formato do `recipe-module`; ganchos `onBelowMinimum`, `onBatchesExpiring`, `onMovementsRecorded`;
`planFefoConsumption` (primeiro que vence, primeiro que sai), puro.

Unidades e decimal exato vêm do [`@adatechnology/recipe-contracts`](../recipe-contracts).
