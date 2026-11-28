---
'@adatechnology/recipe-contracts': minor
'@adatechnology/recipe-module': minor
'@adatechnology/recipes-ui': minor
---

Novo trio de ficha técnica: insumos com custo exato por unidade (`numeric(14,4)`, aritmética de fração sem ponto flutuante), ficha por produto do host com conversão entre unidades compatíveis, rendimento, tempo e modo de preparo; custo por receita e por porção e margem sobre o preço que o host informa (também em lote); lista de compras a partir de quantidades previstas, descontando o estoque quando o host liga `StockLevelPort`; exportação CSV/XLSX. Telas `IngredientsWorkspace`, `RecipeEditor`, `RecipeCostSummary` e `ShoppingListWorkspace`, sem controle nativo. Migration inicial do schema `recipes` (journal `recipe_migrations`).

Integridade e segurança: empresa sempre do token; FK composta impede linha apontar para insumo de outra empresa; apagar insumo em ficha e trocar para unidade que quebraria linhas são recusados (409); ids de caminho validados (404); escopos de leitura, escrita e serviço configuráveis; gancho de auditoria da exportação (aviso no boot quando ausente).
