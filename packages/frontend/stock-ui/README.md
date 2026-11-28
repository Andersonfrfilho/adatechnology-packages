# @adatechnology/stock-ui

Telas de estoque (opcional) com API injetada, montadas com as peças e os tokens do
[`recipes-ui`](../recipes-ui) — por isso vão **dentro** do `RecipesProvider`:

- **`IngredientStockButton`** — para o slot `renderRowActions` do `IngredientsWorkspace`: abre o painel do insumo.
- **`IngredientStockPanel`** — saldo, mínimo, registrar entrada (lote, custo, validade digitada `dd/mm/aaaa`), ajuste e
  perda com motivo; lotes com aviso de validade; últimos movimentos.
- **`StockLevelsWorkspace`** — saldos, crítico primeiro, filtro "só abaixo do mínimo", paginação no servidor.
- **`InventoryWorkspace`** — abrir (um por vez), contar em várias idas, aplicar ou cancelar com confirmação.

```tsx
import '@adatechnology/recipes-ui/styles.css'
import '@adatechnology/stock-ui/styles.css'

<RecipesProvider api={recipesApi}>
  <StockProvider api={stockApi}>
    <IngredientsWorkspace renderRowActions={(ingredient) => <IngredientStockButton ingredientId={ingredient.id} ingredientName={ingredient.name} />} />
  </StockProvider>
</RecipesProvider>
```

Empresa sem estoque: não renderize o `StockProvider` nem o botão (a API do módulo responde 404 `STOCK_DISABLED`).
