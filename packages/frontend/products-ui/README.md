# @adatechnology/products-ui

Telas de produto e catálogo (lista, formulário, importação, workspace), parametrizadas por um
`ProductsApi` injetado. Campos que só existem em algumas verticais são ligados em
`ProductsConfig.fields`.

## API pronta para o `catalog-module`

Host que montou `createCatalogRoutes` do `@adatechnology/catalog-module` não precisa escrever a ponte:

```tsx
import { ProductsWorkspace, createCatalogModuleProductsApi } from '@adatechnology/products-ui'

const api = createCatalogModuleProductsApi({
  baseUrl: '/v1/catalog',                                  // onde as rotas foram montadas
  getHeaders: () => ({ authorization: `Bearer ${token}` }), // chamado a cada requisição
  imageUpload: true,                                        // só se o módulo tem storage de imagem
})
```

- Converte `{ data, pagination }` do módulo para `{ data, total, page, pageSize, totalPages }`.
- `bulkImportProducts` lê o CSV no navegador (`parseBulkImportCsv`: cabeçalho sem acento nem caixa,
  `Nome`/`Preço`/`Catálogo`/`Seção`/`Estoque`...) e manda as linhas; troque com `parseBulkImportFile`.
- Erro vira `CatalogModuleApiError` com `status` e o `code` estável do envelope.
- O token precisa trazer `catalog:read`/`catalog:write` (ver README do `catalog-module`).

Host com API própria continua implementando `ProductsApi` à mão.

## Lista em tabela (opt-in)

Sem `listing`, o workspace segue como antes. Com ele, a área de produtos vira a listagem padrão da casa:
busca à esquerda (debounce, no servidor), filtros de seleção múltipla (Catálogo, Seção, Disponibilidade,
Preço), cabeçalhos que alternam crescente/decrescente/neutro, linhas zebradas, caixa de seleção por linha com
barra de ações em lote (ativar, desativar, mover de catálogo, excluir com confirmação na própria barra),
paginação no servidor com itens por página, total de resultados e cartões abaixo de 768px.
"Limpar filtros" só aparece com filtro ou ordem aplicados.

```tsx
<ProductsWorkspace
  sections={sections}
  listing={{
    query,                       // estado controlado (URL); sem `onQueryChange` a lista guarda o próprio
    onQueryChange: setQuery,
    renderSelect: (props) => <SelectMenu {...props} />,            // seu Select (nunca <select> nativo)
    renderMultiSelect: (props) => <MultiSelectMenu {...props} />,  // seu multi-select
    renderExport: (context) => <ExportMenu {...context} />,        // encaixe do menu de exportação
  }}
/>
```

- **URL:** `PRODUCTS_LIST_QUERY_KEYS` + `serializeProductsListQuery(query)` / `parseProductsListQuery(values)`
  convertem o estado para pares de texto (valor padrão = vazio, a chave some).
- **Exportação:** `renderExport` recebe `{ query, total, pageProducts, selectedProducts }`; `toListProductsParams(query)`
  dá os parâmetros do filtro atual para a rota de exportação do host.
- **Lote:** usa `ProductsApi.updateProducts`/`deleteProducts` se o host os implementa (um único aviso ao fim);
  senão repete `updateProduct`/`deleteProduct` sem parar no primeiro erro. `createCatalogModuleProductsApi` já os traz.
- **Servidor:** exige `catalog-module` com `catalogIds`, `sectionIds`, `priceOnRequest`, `sortBy` e `sortDirection`
  em `GET /products`. `labels` aceita qualquer texto da lista (`DEFAULT_PRODUCTS_LISTING_LABELS`).
- As colunas Seção e Ordem seguem `ProductsConfig.fields` (`SECTION`, `SORT_ORDER`): campo desligado, coluna ausente.

## Campos opcionais gerais

```tsx
import { PRODUCT_OPTIONAL_FIELD, ProductsProvider } from '@adatechnology/products-ui'

<ProductsProvider
  api={api}
  config={{
    fields: [
      PRODUCT_OPTIONAL_FIELD.PRICE_ON_REQUEST,      // interruptor "Preço sob consulta" -> priceInCents: null
      PRODUCT_OPTIONAL_FIELD.AVAILABILITY_SCHEDULE, // chips de dia da semana + intervalo de horário (+ fuso)
      PRODUCT_OPTIONAL_FIELD.ATTRIBUTES,            // editor chave/valor -> attributes
    ],
    priceOnRequestLabel: 'Sob consulta', // texto na lista quando o preço é null
  }}
>
```

- A lista mostra `priceOnRequestLabel` quando `priceInCents === null`, com ou sem o campo ligado.
- Ao editar, desligar a agenda envia `availabilitySchedule: null`; `attributes` é enviado inteiro
  (o backend substitui o objeto). Valores que não são texto (número, lista) voltam intactos se não
  forem editados.
- `AvailabilityScheduleEditor` e `AttributesEditor` também são exportados para telas próprias.

## Seletor de hora próprio (`renderTimeInput`)

O horário de venda (`Das`/`Até`) usa `<input type="time">` por padrão. Para o seletor 24h do seu
design system, passe `renderTimeInput` ao `ProductForm` (ou ao `AvailabilityScheduleEditor`). Valor
`HH:mm` ou vazio.

```tsx
<ProductForm renderTimeInput={({ id, label, value, onChange }) => (
  <TimeInput id={id} label={label} value={value} onChange={onChange} />
)} />
```
