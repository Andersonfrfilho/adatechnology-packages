# @adatechnology/recipe-module

Ficha técnica plugável: **insumos** com custo exato por unidade, **ficha por produto do host** (linhas com conversão
entre unidades compatíveis, rendimento em porções, tempo e modo de preparo), **custo por receita e por porção**,
**margem** sobre o preço de venda que o host informa e **lista de compras** a partir de quantidades previstas, com
estoque opcional por porta. Tabelas no schema Postgres `recipes`, journal próprio (`recipe_migrations`).

Tipos, schemas e o cálculo puro em [`@adatechnology/recipe-contracts`](../recipe-contracts); telas em
[`@adatechnology/recipes-ui`](../../frontend/recipes-ui).

## O que o módulo não faz (de propósito)

- **Não tem produtos nem preços.** O produto é uma referência opaca (`productId`) do catálogo do host; o preço de venda
  chega por parâmetro (`salePriceCents`) para a margem.
- **Não tem estoque.** A lista de compras mostra a necessidade bruta; com um `StockLevelPort` ligado (o futuro
  `stock-module`, ou o estoque do host) desconta o que há. Baixa por pedido, lotes, validade, inventário e perdas são
  do módulo de estoque, que consome as fichas daqui por `lookupRecipes` + `calculateIngredientNeedsExact`.

## Instalação

```bash
bun add @adatechnology/recipe-module @adatechnology/recipe-contracts drizzle-orm
```

## Uso

```ts
import { createRecipeModule, createRecipeRoutes, runRecipeMigrations } from '@adatechnology/recipe-module'
import { createModuleFetchRouter } from '@adatechnology/recipe-module/http/fetch'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

await runRecipeMigrations({ db, migrate: (target, config) => migrate(target as never, config) })

const recipes = createRecipeModule({
  db,
  config: {
    // Mapeie as permissões do host para estes escopos no authResolver (padrões: recipes:read/write/service).
    scopes: { read: ['products:read'], write: ['products:write'] },
  },
  providers: {
    logger,
    // Opcional: confere que o produto existe na empresa antes de gravar a ficha.
    productReference: { findExisting: ({ companyId, productIds }) => catalog.existingIds({ companyId, productIds }) },
    // Opcional: estoque atual por insumo (na unidade do insumo) para a lista de compras.
    stockLevels: { getLevels: ({ companyId, ingredientIds }) => stock.levels({ companyId, ingredientIds }) },
  },
  hooks: { onExported: (event) => audit.record('recipes.export', event) },
})

const router = createModuleFetchRouter({ routes: createRecipeRoutes({ module: recipes }), basePath: '/v1/recipes', authResolver })
```

O `authResolver` do host devolve `{ companyId, userId, scopes }` a partir do token já validado: **a empresa vem sempre
do token**, nunca do corpo ou do caminho.

## Rotas

| Método e caminho | Escopo | O que faz |
|---|---|---|
| `GET /ingredients` | leitura | lista paginada: `search` (nome ou fornecedor), `unit=kg,g`, `sort=name\|unit\|costPerUnit\|updatedAt`, `order`, `page`, `pageSize` (≤ 100) |
| `GET /ingredients/export?format=csv\|xlsx` | leitura | todos os resultados do filtro (teto `exportRowLimit`, cabeçalho `X-Export-Truncated`) |
| `POST /ingredients` · `PATCH /ingredients/:id` · `DELETE /ingredients/:id` | escrita | criar, alterar, apagar; apagar insumo em ficha → 409 `RECIPE_INGREDIENT_IN_USE`; trocar para unidade sem conversão das linhas → 409 `RECIPE_UNIT_CHANGE_IN_USE` |
| `GET /ingredients/:id` | leitura | insumo |
| `GET /recipes/:productId?salePriceCents=` | leitura | `{ recipe, cost, ingredients }`; 404 sem ficha |
| `PUT /recipes/:productId` | escrita | grava a ficha inteira (linhas trocadas numa transação; linha que já era da ficha mantém o id) |
| `DELETE /recipes/:productId` | escrita | apaga a ficha |
| `POST /recipe-costs` | leitura | custo e margem de até 500 produtos de uma vez (lista do catálogo) |
| `POST /shopping-lists` · `POST /shopping-lists/export` | leitura | lista de compras (e arquivo CSV/XLSX) para `{ items: [{ productId, quantity }] }` |
| `POST /service/recipes/lookup` | serviço | fichas + insumos de vários produtos, para o backend do host ou o módulo de estoque |

Id de caminho inválido responde 404 (o mesmo de "não existe"); corpo inválido 400 com os campos.

## Dinheiro e quantidade

`numeric(14,4)` no banco e texto decimal de 4 casas no JSON (`"32.9000"`). As contas usam fração de `bigint`
(`@adatechnology/recipe-contracts`), sem ponto flutuante; centavos (`*Cents`) são arredondados meio para cima e a
necessidade da lista de compras arredonda para cima. A margem sai em centavos e em pontos-base (`marginBasisPoints`).

## Ganchos

`onIngredientSaved`, `onIngredientRemoved`, `onRecipeSaved`, `onRecipeRemoved`, `onExported` rodam **depois** do commit;
erro no gancho é logado (só ids) e não desfaz a gravação. Host que espelha dados (ex.: mantém uma tabela antiga em
sincronia durante a migração) deve ter uma reconciliação idempotente, não confiar só no gancho.

## Testes

```bash
bun test                                                   # unidade + rotas (dublê em memória)
docker run -d --rm --name recipes-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:17
DRIZZLE_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/postgres bun test
docker stop recipes-test-pg
```

`createInMemoryRecipePersistence()` serve aos testes do host (mesmas regras: empresa, FK RESTRICT, ficha única por produto).
