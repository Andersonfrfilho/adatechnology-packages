# @adatechnology/recipes-ui

Telas de ficha técnica com API injetada (o pacote não faz `fetch`):

- **`IngredientsWorkspace`** — busca com rótulo (servidor, com debounce), filtro de unidade múltiplo, colunas
  ordenáveis, tabela zebrada (cartões no celular), paginação no servidor, total, exportar página ou todos do filtro
  (CSV/Excel), criar, editar e excluir com confirmação e aviso quando o insumo está em ficha. Slot
  `renderRowActions(ingredient)` para ações do host na linha (ex.: abrir o estoque do insumo).
- **`RecipeEditor`** — abre dentro da tela do produto do host: rendimento, tempo e modo de preparo, insumos buscados
  enquanto digita, unidade só entre as que convertem, custo de cada linha e resumo ao vivo (mesmo cálculo do servidor).
- **`RecipeCostSummary`** — custo da receita, por porção, preço e margem (negativa em destaque).
- **`ShoppingListWorkspace`** — produtos e quantidades previstas (o host pode oferecer origens, como "encomendas de
  amanhã"), necessidade, estoque quando ligado, a comprar, custo estimado e exportação.
- Headless: `useIngredientList`, `useRecipeEditor`, `useShoppingList`.

Sem controle nativo: seleção vira grupo de botões (até 3) ou lista acessível com filtro digitável (9 ou mais); o host
injeta o componente do design system com `renderSelect`. Textos por `messages` (pt-BR padrão, `en`); tema pelas
variáveis `--arc-*` (cor, raio, espaço, fonte) e `import '@adatechnology/recipes-ui/styles.css'`.

```tsx
<RecipesProvider api={recipesApi} messages={{ ingredientsTitle: 'Matérias-primas' }}>
  <RecipeEditor productId={product.id} productName={product.name} salePriceCents={product.priceInCents} />
</RecipesProvider>
```

`RecipesApi.getRecipe` devolve `null` quando o produto não tem ficha (traduza o 404 do `recipe-module`).
