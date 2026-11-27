# @adatechnology/recipe-contracts

Contratos do trio de fichas técnicas — isomórfico, sem I/O:

- Tipos `Ingredient`, `Recipe`, `RecipeLine`, `RecipeCost`, `RecipeDetail`, `ShoppingList`, `StockLevel`.
- Schemas zod compartilhados pela rota e pelo formulário (`createIngredientSchema`, `saveRecipeSchema`,
  `shoppingListSchema`…); decimal aceita vírgula e sai canônico com 4 casas.
- **Aritmética exata** (`parseDecimal`, `multiply`, `divide`, `formatDecimal`, `toCents`) sobre fração de `bigint`.
- **Unidades** `mg g kg ml l un dz` e `convertQuantity` exata entre as compatíveis.
- **Cálculo puro**: `calculateRecipeCost` (por receita, por porção e margem), `calculateIngredientNeedsExact`
  (quanto de cada insumo um conjunto de produtos consome — a mesma regra serve a lista de compras e a baixa de estoque),
  `buildShoppingList` e `shoppingListTable`.
- Portas `StockLevelPort` e `ProductReferencePort`, ganchos `RecipeHooks`, erros `RecipeError` com `publicDetails`.
- `buildCsv` (neutraliza fórmula) e `buildXlsx` sem dependência.

```ts
import { calculateRecipeCost } from '@adatechnology/recipe-contracts'

const cost = calculateRecipeCost({ recipe, ingredients, salePriceCents: 1200 })
cost.costPerPortion // "1.7000"
cost.marginBasisPoints // 8583 (85,83 %)
```
