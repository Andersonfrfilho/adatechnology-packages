# Adoção: ficha técnica e estoque do SDK no Comandada

Roteiro para trocar a ficha técnica e o estoque feitos à mão no Comandada pelos trios `recipe-*` e `stock-*` do SDK,
**sem perder dado** e mantendo os ids dos insumos. Escrito a partir da leitura do código do Comandada (só leitura;
nada foi alterado lá). Nenhum dado de empresa aparece aqui: os exemplos usam ids fictícios.

> Este roteiro só roda **depois da publicação** dos pacotes (merge com ok escrito do dono → `publish.yml`). Antes
> disso, os pacotes não existem no npm e o CI do Comandada quebra.

## 1. Pacotes e versões

| Lado | Pacote | Versão |
|---|---|---|
| API | `@adatechnology/recipe-contracts` | `<version after publication>` |
| API | `@adatechnology/recipe-module` | `<version after publication>` |
| API | `@adatechnology/stock-contracts` | `<version after publication>` |
| API | `@adatechnology/stock-module` | `<version after publication>` |
| Web | `@adatechnology/recipes-ui` | `<version after publication>` |
| Web | `@adatechnology/stock-ui` | `<version after publication>` |

Conferir antes: `npm view @adatechnology/recipe-module dist-tags` (o repositório do SDK publica em `rc` quando está em
modo pré-release: fixar a versão `x.y.z-rc.N` exata). Versão fixa, sem `^`, como o resto das dependências do Comandada.

## 2. O que existe hoje e para onde vai

| Hoje no Comandada | Vai para | Observação |
|---|---|---|
| `public.ingredients` (`name`, `unit`, `cost_per_unit numeric(10,4)`) | `recipes.ingredients` (mesmo `id`, `company_id = establishment_id`, `cost_per_unit numeric(14,4)`) | Unidades atuais (`un kg g l ml`) existem no módulo. |
| `public.ingredients.stock_quantity`, `minimum_stock` | `stock.levels` (`quantity`, `minimum_quantity`, `unit` = unidade do insumo) | Chave `(company_id, ingredient_id)`. |
| `public.ingredients.section_id` | **fica no Comandada** (coluna antiga) | O painel não usa; só a API aceita. Perguntar ao dono se ainda serve antes de esquecer. |
| `public.product_ingredients` | `recipes.recipe_lines` (mesmo `id`) dentro de `recipes.recipes` (uma por produto, `product_id = products.id::text`) | Rendimento `1`: no Comandada a quantidade sempre foi por unidade vendida. |
| `products.preparation_time_minutes`, `preparation_instructions` | `recipes.recipes.preparation_time_minutes`, `instructions` | A coluna do produto continua, espelhada (ver §5.3). |
| `public.stock_batches` | `stock.batches` (mesmo `id`, `batch_code = batch_number`) | `expires_at` hoje é obrigatório; no módulo é opcional. |
| `public.stock_movements` (`in`, `out`, `adjustment`, `loss`) | `stock.movements` (mesmo `id`; `in`, `out`, `adjust`, `loss`; `delta` com sinal) | `user_id` vira `actor_id`; `order_id` vira `source_key`. |
| `DeductStockForOrderUseCase` (chamado em `UpdateOrderStatusUseCase`) | `stockModule.useCases.deductOrder` | Idempotente por linha: chave `order:<orderId>:<orderItemId>`. Combo (`product_components`): expandir nos componentes antes, como hoje. |
| `CreateStockBatchUseCase`, `CreateStockMovementUseCase` | `receiveBatch`, `adjustStock`, `recordLoss` | Motivo obrigatório em ajuste e perda (hoje opcional). |
| `StockExpiryAlerter` (fila `stockExpiryQueue`, `0 8 * * *`, `settings.stock.expiry_alert_days`) | `scanExpiringBatches({ withinDays })` + `hooks.onBatchesExpiring` | O cron e a fila continuam do Comandada; só a consulta muda. |
| "Insumos mais usados" (`GetIngredientsRankingUseCase`, `stock_movements ⋈ ingredients`) | consulta sobre `stock.movements` (kind `out`) ⋈ `recipes.ingredients` | Mesmo resultado; ver §5.4. |
| Rotas `/ingredients*`, `/stock-batches*`, `/stock-movements*` | rotas do módulo montadas por `router.raw` | Ver §4. |

### Por que manter os ids

Todo o histórico (movimentos, lotes, relatórios, sincronização da loja) aponta para o id do insumo. Copiando com o
mesmo id, nenhum histórico precisa ser reescrito, a sincronização da loja reconhece as linhas e as tabelas antigas
continuam consultáveis como estavam.

## 3. Migração de dados

Uma migration SQL do Comandada (ex.: `0044_recipe_stock_sdk.sql`), **depois** de `runRecipeMigrations` e
`runStockMigrations` no boot (criam os schemas `recipes` e `stock`). Tudo `INSERT ... ON CONFLICT DO NOTHING`:
rodar duas vezes não duplica. **Nenhum `DROP`, nenhum `UPDATE` nas tabelas antigas.**

### 3.1 Conferências antes (guardar o resultado em `evidence.md`)

```sql
SELECT count(*) AS ingredients FROM public.ingredients;
SELECT count(*) AS lines FROM public.product_ingredients;
SELECT count(DISTINCT product_id) AS products_with_lines FROM public.product_ingredients;
SELECT count(*) AS products_with_prep FROM public.products
  WHERE preparation_time_minutes IS NOT NULL OR coalesce(preparation_instructions, '') <> '';
SELECT count(*) AS batches FROM public.stock_batches;
SELECT count(*) AS movements FROM public.stock_movements;

-- Bloqueantes (precisam dar zero, ou parar e perguntar):
SELECT count(*) FROM public.ingredients WHERE unit NOT IN ('mg','g','kg','ml','l','un','dz');
SELECT count(*) FROM public.ingredients WHERE cost_per_unit < 0;
SELECT count(*) FROM public.product_ingredients WHERE quantity <= 0;
SELECT count(*) FROM public.product_ingredients pi
  JOIN public.products p ON p.id = pi.product_id
  JOIN public.ingredients i ON i.id = pi.ingredient_id
  WHERE p.establishment_id <> i.establishment_id;              -- linha de outra empresa
SELECT count(*) FROM public.stock_batches
  WHERE remaining_quantity < 0 OR remaining_quantity > quantity OR quantity <= 0;
SELECT count(*) FROM public.stock_movements WHERE quantity = 0;

-- Unidade da linha diferente da do insumo (o custo antigo ignorava a unidade da linha):
SELECT pi.unit AS line_unit, i.unit AS ingredient_unit, count(*)
  FROM public.product_ingredients pi JOIN public.ingredients i ON i.id = pi.ingredient_id
  WHERE pi.unit <> i.unit GROUP BY 1, 2;
```

**Unidade da linha.** O Comandada calculava `quantidade × custo` sem olhar a unidade da linha, e a baixa tirava a
quantidade na unidade do insumo. Para manter exatamente o que o restaurante via:

- dimensão diferente (linha `un` num insumo em `kg`, o padrão antigo da coluna): a linha migra **na unidade do insumo**;
- mesma dimensão, unidade diferente (linha `g` num insumo em `kg`): o módulo passa a converter, e o custo dessas fichas
  muda (para o certo). **Parar e mostrar a lista ao dono** antes de migrar; ele decide entre converter (padrão) ou
  migrar na unidade do insumo.

### 3.2 Cópia

```sql
INSERT INTO recipes.ingredients (id, company_id, name, unit, cost_per_unit, created_at, updated_at)
SELECT id, establishment_id, left(name, 160), unit, cost_per_unit, created_at, updated_at
FROM public.ingredients
ON CONFLICT (id) DO NOTHING;

INSERT INTO recipes.recipes (company_id, product_id, yield_portions, preparation_time_minutes, instructions)
SELECT p.establishment_id, p.id::text, 1, p.preparation_time_minutes, coalesce(p.preparation_instructions, '')
FROM public.products p
WHERE EXISTS (SELECT 1 FROM public.product_ingredients pi WHERE pi.product_id = p.id)
   OR p.preparation_time_minutes IS NOT NULL
   OR coalesce(p.preparation_instructions, '') <> ''
ON CONFLICT (company_id, product_id) DO NOTHING;

INSERT INTO recipes.recipe_lines (id, company_id, recipe_id, ingredient_id, quantity, unit, notes, position, created_at, updated_at)
SELECT pi.id, p.establishment_id, r.id, pi.ingredient_id, pi.quantity,
       CASE WHEN dimension(pi.unit) = dimension(i.unit) THEN pi.unit ELSE i.unit END,   -- ver nota abaixo
       pi.notes,
       row_number() OVER (PARTITION BY pi.product_id ORDER BY pi.created_at, pi.id) - 1,
       pi.created_at, pi.updated_at
FROM public.product_ingredients pi
JOIN public.products p ON p.id = pi.product_id
JOIN public.ingredients i ON i.id = pi.ingredient_id
JOIN recipes.recipes r ON r.company_id = p.establishment_id AND r.product_id = p.id::text
ON CONFLICT (id) DO NOTHING;
```

`dimension()` não existe no Postgres: escrever o `CASE` com os grupos (`mg g kg` massa, `ml l` volume, `un dz`
contagem), ou trocar por `i.unit` se o dono decidir migrar tudo na unidade do insumo.

```sql
INSERT INTO stock.levels (company_id, ingredient_id, unit, quantity, minimum_quantity, created_at, updated_at)
SELECT establishment_id, id, unit, stock_quantity, minimum_stock, created_at, updated_at
FROM public.ingredients
ON CONFLICT (company_id, ingredient_id) DO NOTHING;

INSERT INTO stock.batches (id, company_id, ingredient_id, batch_code, unit, quantity, remaining_quantity, cost_per_unit, expires_at, received_at)
SELECT b.id, b.establishment_id, b.ingredient_id, left(b.batch_number, 100), i.unit, b.quantity, b.remaining_quantity, b.cost_per_unit, b.expires_at, b.created_at
FROM public.stock_batches b JOIN public.ingredients i ON i.id = b.ingredient_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO stock.movements (id, company_id, ingredient_id, batch_id, kind, delta, unit, reason, actor_id, source_key, created_at)
SELECT m.id, m.establishment_id, m.ingredient_id, m.batch_id,
       CASE m.movement_type WHEN 'adjustment' THEN 'adjust' ELSE m.movement_type END,
       CASE m.movement_type WHEN 'in' THEN abs(m.quantity) WHEN 'out' THEN -abs(m.quantity) ELSE m.quantity END,
       i.unit,
       left(coalesce(nullif(m.reason, ''), 'Migrado'), 255),
       m.user_id::text,
       CASE WHEN m.order_id IS NOT NULL THEN 'order:' || m.order_id || ':legacy' END,
       m.created_at
FROM public.stock_movements m JOIN public.ingredients i ON i.id = m.ingredient_id
WHERE m.quantity <> 0
ON CONFLICT (id) DO NOTHING;

-- Pedido já baixado à mão não pode baixar de novo pelo módulo: marca cada linha como aplicada.
INSERT INTO stock.deductions (company_id, source_key, created_at)
SELECT DISTINCT o.establishment_id, 'order:' || o.id || ':' || oi.id, now()
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
WHERE EXISTS (SELECT 1 FROM public.stock_movements m WHERE m.order_id = o.id AND m.movement_type = 'out')
ON CONFLICT DO NOTHING;
```

Conferir os nomes de coluna de `orders`/`order_items` no schema do Comandada antes de rodar (o roteiro foi escrito
lendo o código; a fonte da verdade é o schema).

### 3.3 Conferências depois

```sql
SELECT (SELECT count(*) FROM public.ingredients)          = (SELECT count(*) FROM recipes.ingredients WHERE id IN (SELECT id FROM public.ingredients)) AS ingredients_ok,
       (SELECT count(*) FROM public.product_ingredients)  = (SELECT count(*) FROM recipes.recipe_lines WHERE id IN (SELECT id FROM public.product_ingredients)) AS lines_ok,
       (SELECT count(*) FROM public.stock_batches)        = (SELECT count(*) FROM stock.batches WHERE id IN (SELECT id FROM public.stock_batches)) AS batches_ok,
       (SELECT count(*) FROM public.stock_movements WHERE quantity <> 0) = (SELECT count(*) FROM stock.movements WHERE id IN (SELECT id FROM public.stock_movements)) AS movements_ok,
       (SELECT count(*) FROM public.ingredients)          = (SELECT count(*) FROM stock.levels) AS levels_ok;

-- Saldo e mínimo iguais, insumo a insumo:
SELECT count(*) FROM public.ingredients i JOIN stock.levels l ON l.ingredient_id = i.id
WHERE l.quantity <> i.stock_quantity OR l.minimum_quantity IS DISTINCT FROM i.minimum_stock;   -- zero

-- Custo da ficha igual ao antigo para as linhas sem conversão (amostra de 20 produtos, pela rota POST /recipe-costs).
```

Registrar as contagens antes/depois no `evidence.md`, com a data e o banco (local, staging). Divergência entre o saldo
antigo (`stock_quantity`) e a soma dos movimentos antigos **não é corrigida pela migração**: é dado legado; listar e
mostrar ao dono.

### 3.4 Volta atrás

- **Antes da troca de código:** as tabelas antigas não foram tocadas. Volta = apagar o que foi copiado para os schemas
  novos (`DELETE FROM recipes.recipe_lines`, `recipes.recipes`, `recipes.ingredients`, `stock.*` das empresas
  migradas) ou simplesmente não subir o código novo. Os schemas novos ficam vazios e inofensivos.
- **Depois da troca:** o que for gravado pelo módulo não volta sozinho para as tabelas antigas. Por isso a troca em
  produção é feita **com backup tirado na hora**, fora do horário de pedidos, e a conferência do §3.3 roda na mesma
  janela; voltar é reverter o deploy e restaurar o backup (perdendo o que foi gravado desde a troca). Em staging, a
  troca e a volta são ensaiadas antes, de ponta a ponta.

## 4. Ligação na API

Arquivo novo `apps/api/src/infra/recipes/recipeStockModules.ts`, no molde de `infra/scheduling/schedulingModule.ts`:

- `createRecipeModule({ db, config: { scopes }, providers: { productReference, stockLevels }, hooks })`;
- `createStockModule({ db, config: { isEnabledForCompany, expiryAlertDays }, providers: { catalog, recipes }, hooks })`
  — `catalog` = `recipes.useCases.findIngredients`, `recipes` = `recipes.useCases.lookupRecipes`;
- `productReference.findExisting`: `SELECT id FROM products WHERE establishment_id = $1 AND id = ANY($2)`;
- migrations em `infra/database/connection.ts`, ao lado de `runSchedulingMigrations`:
  `await runRecipeMigrations({ db, migrate })` e `await runStockMigrations({ db, migrate })`, **antes** da migration
  de cópia do §3.

**Rotas.** O router do Comandada não é o `module-http`; montar com o adaptador fetch por `router.raw`:

```ts
const recipesRouter = createModuleFetchRouter({ routes: createRecipeRoutes({ module: recipes }), basePath: '/recipes-sdk', authResolver })
router.raw('GET', '/recipes-sdk/*', (request) => recipesRouter.handle(request))   // e os demais métodos
```

(conferir se o `router.raw` aceita curinga; senão, registrar cada caminho da tabela de rotas do módulo).

**Identidade e permissões.** `authResolver` reaproveita a verificação do `authenticate` (JWT HS256 do Comandada):
`companyId = payload.establishmentId`, `userId = payload.sub`, e os escopos saem das permissões do papel:

| Permissão do Comandada | Escopo |
|---|---|
| `products:read` | `recipes:read`, `stock:read` |
| `products:write` | `recipes:write`, `stock:write` |
| `products:delete` | (excluir insumo/ficha é `recipes:write` no módulo; manter quem tem `delete` como hoje exige criar um escopo próprio — perguntar ao dono) |

Backend chamando a baixa: direto no use case (`deductOrder.execute`), sem HTTP; a rota de serviço não precisa subir.

**Estoque ligado por empresa.** `isEnabledForCompany` lê uma chave de `settings` (ex.: `stock.enabled`), com padrão
**ligado** para quem já usa estoque hoje (tem lote ou movimento) — confirmar o padrão com o dono.

**Fuso.** O módulo grava `timestamptz` e não formata data. O Comandada já tem o fuso do estabelecimento nas
configurações: usar na varredura de validade (fim do dia local) e passar `locale`/datas formatadas na tela.

## 5. O que muda no código do Comandada

### 5.1 Substituído

- `modules/products/infra/http/IngredientController.ts` e `IngredientRoutes.ts` (insumos e linhas de ficha);
- `StockBatchController`/`Routes`, `StockMovementController`/`Routes`, `CreateStockBatchUseCase`,
  `CreateStockMovementUseCase`;
- `DeductStockForOrderUseCase` → um adaptador pequeno que expande combos (`product_components`) e chama `deductOrder`
  com `lineKey = order_items.id`, no mesmo ponto de `UpdateOrderStatusUseCase`;
- consulta do `StockExpiryAlerter` → `scanExpiringBatches`; a notificação continua a do Comandada;
- seeds `catalog.seed.ts` (receitas) e `stock-consumption.seed.ts` → use cases dos módulos (regra: seed chama use case).

### 5.2 Mantido

- Tabelas antigas (`ingredients`, `product_ingredients`, `stock_batches`, `stock_movements`) e as colunas de preparo de
  `products`: só leitura, como histórico. Sem `DROP` neste ciclo.
- `EstimateOrderTimeUseCase` e o relatório de tempo de preparo, que leem `products.preparation_time_minutes`
  (espelhado, §5.3).
- `section_id` dos insumos (ver §2).

### 5.3 Espelho do tempo de preparo

`hooks.onRecipeSaved` / `onRecipeRemoved` do `recipe-module` atualizam `products.preparation_time_minutes` e
`preparation_instructions`. O gancho roda depois do commit e não desfaz a gravação se falhar, então há também uma
reconciliação idempotente no boot (`UPDATE products p SET ... FROM recipes.recipes r WHERE r.product_id = p.id::text
AND (... IS DISTINCT FROM ...)`). `CatalogController` deixa de aceitar os dois campos (a ficha passa a ser o único lugar
de edição) e o formulário do produto perde os campos.

### 5.4 Relatório de insumos mais usados

`GetIngredientsRankingUseCase`: trocar a junção para `stock.movements` (kind `out`, `delta` negativo → `abs`) com
`recipes.ingredients` para o nome. Teste com os mesmos números antes e depois da migração.

### 5.5 Sincronização da loja (offline)

`modules/sync/shared/syncTables.constant.ts` lista `public.ingredients` (contador `stock_quantity`),
`product_ingredients`, `stock_batches` (contador `remaining_quantity`) e `stock_movements`. As tabelas novas precisam
entrar na mesma lista, na ordem pais → filhos: `recipes.ingredients`, `recipes.recipes`, `recipes.recipe_lines`,
`stock.levels` (contador `quantity`), `stock.batches` (contador `remaining_quantity`), `stock.movements`,
`stock.deductions`, `stock.inventory_counts`, `stock.inventory_count_lines`. **Parar e perguntar**: baixa offline na loja
e na nuvem para o mesmo pedido é decidida pela PK de `stock.deductions` — confirmar como o sincronizador resolve
conflito de PK antes de ligar.

## 6. Painel (web)

- `pages/catalog/components/IngredientManager.tsx` → `IngredientsWorkspace` do `recipes-ui`, com
  `renderRowActions={(ingredient) => <IngredientStockButton .../>}` quando o estoque está ligado.
- `RecipeManager.tsx` → `RecipeEditor` dentro do produto (`productId`, `productName`, `salePriceCents` do preço atual).
- `RecipeCostBadge` → uma chamada `POST /recipe-costs` com os produtos da página (não uma por produto, como hoje).
- `StockBatchList`, `StockAdjustmentForm`, `StockMovementHistory`, `ExpiringBatchBadge` → `IngredientStockPanel`,
  `StockLevelsWorkspace` (e o contador de "abaixo do mínimo" sai de `listLevels({ belowMinimum: true })`).
- Tela nova de **lista de compras** (`ShoppingListWorkspace`) com `plannedItemsSources` ligados às encomendas
  (agenda) dos próximos dias e às reservas de mesa, se houver.
- `RecipesProvider` com `renderSelect` do design system do painel, `messages` para o vocabulário do produto, tokens
  `--arc-*` com a paleta do painel; `import` dos dois `styles.css`.
- `RecipesApi`/`StockApi` implementados sobre o `api` do painel (TanStack Query do host), traduzindo o 404 de
  `GET /recipes/:productId` para `null`.

## 7. Testes

- `bun run typecheck` e `bun test` em `apps/api` e `apps/web`.
- Teste da migração em banco descartável com uma cópia **anonimizada** (sem dado de cliente), conferindo o §3.3.
- Baixa: pedido com combo, pedido repetido (status volta e vai), dois pedidos simultâneos do mesmo insumo.
- Relatório de insumos mais usados e estimativa de preparo iguais antes e depois.
- Painel nas larguras 1366 e 375: lista de insumos, ficha dentro do produto, estoque do insumo, lista de compras.

## 8. Pronto quando

- Contagens e somas do §3.3 iguais, registradas em `evidence.md` (local e staging).
- Nenhuma rota antiga de insumo/estoque em uso pelo painel; nenhum `product_ingredients` lido por código vivo.
- Pedido entregue em staging baixa uma vez, pela ficha, e aparece no histórico do insumo com o autor.
- Lista de compras com e sem estoque ligado; aviso de mínimo e de validade chegando pelo canal do Comandada.
- Revisão final (gate de publicação) feita; CI verde.

## 9. Parar e perguntar antes de

- rodar a migração de dados em **staging** ou **produção** (é gravação de dados);
- qualquer **deploy**;
- decidir a unidade das linhas de mesma dimensão e unidade diferente (§3.1);
- o padrão de `stock.enabled` por empresa, o escopo de exclusão e o destino de `section_id`;
- ligar a sincronização da loja nas tabelas novas (§5.5);
- apagar qualquer tabela ou coluna antiga (não faz parte deste ciclo).

## 10. Prompt de execução

```text
/oh-my-claudecode:autopilot Aplique os módulos de ficha técnica e estoque do SDK no Comandada seguindo
adatechnology-packages/docs/adoption/comandada-recipe-stock.md (leia o arquivo inteiro e o CLAUDE.md do Comandada
antes de tocar em código). Trabalhe num worktree novo do Comandada a partir da branch padrão, sem mexer no checkout
principal. Pacotes: recipe-contracts, recipe-module, stock-contracts, stock-module (API) e recipes-ui, stock-ui (web),
nas versões publicadas (confira com npm view; se não existirem, pare).
Fases e modelos:
  Fase 1 (ligação na API: módulos, migrations, authResolver, rotas por router.raw) → executor model=sonnet
  Fase 2 (migração de dados §3 em banco local descartável com cópia anonimizada, contagens antes/depois) → executor model=sonnet
  T2.x 🧠 decisão da unidade das linhas e do padrão de stock.enabled → parar e perguntar ao dono
  Fase 3 (substituir controllers/use cases §5.1, espelho de preparo §5.3, relatório §5.4) → executor model=sonnet
  Fase 4 (painel §6: IngredientsWorkspace, RecipeEditor, IngredientStockPanel, ShoppingListWorkspace) → executor model=sonnet
  Fase 5 (passes mecânicos: seeds para use cases, textos, remoção de imports mortos) → executor model=haiku
  Revisão final → code-reviewer model=sonnet; gate de publicação → opus
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com bun run typecheck + bun test (api e web) + commit isolado, evidência em evidence.md.
Pare e pergunte antes de: migração de dados em staging ou produção, deploy, ligar a sincronização da loja nas
tabelas novas, apagar tabela ou coluna antiga, e qualquer ponto da seção 9.
```
