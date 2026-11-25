---
'@adatechnology/catalog-module': minor
'@adatechnology/products-ui': minor
---

Catálogo e `products-ui` funcionam juntos sem ponte escrita à mão.

- `catalog-module` (correção): `productCount` da listagem de catálogos voltava sempre 0 — a subquery correlacionava `products.catalog_id` com `products.id`, porque o Drizzle escreve coluna sem tabela em consulta de tabela única. A listagem de produtos passa a trazer `catalogName` (uma consulta por página, não por produto).
- `catalog-module` (novo): `GET /catalogs/:id` e `GetCatalogUseCase`, com `productCount`.
- `products-ui` (novo): `createCatalogModuleProductsApi({ baseUrl, getHeaders })` implementa `ProductsApi` sobre as rotas do módulo, convertendo `{ data, pagination }` para o formato da tela; `parseBulkImportCsv` e `CatalogModuleApiError` exportados.
- `products-ui` (correção): o leitor de CSV da importação perdia a primeira linha (o cabeçalho); a prévia continua mostrando só as linhas de dados.

Nenhuma rota nem formato existente mudou: hosts com adaptador próprio seguem funcionando.
