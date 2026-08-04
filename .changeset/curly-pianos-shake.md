---
'@adatechnology/products-ui': minor
---

`CatalogList` ganha a variante `sidebar`: painel de navegação com seleção
controlada (`selectedId`/`onSelect`), entrada opcional "sem catálogo"
(`CATALOG_NONE`) e edição inline. A variante `table` continua o padrão.

`Catalog` ganha `sortOrder` opcional, exposto no formulário sob `showSortOrder`,
e os campos de sincronização (`externalId`, `syncStatus`, `syncError`) que o
`Product` já tinha.

Sincronização com a Meta vira configuração: `ProductsConfig.metaSync`
(`{ products, catalogs }`), desligada por padrão. **Breaking:**
`PRODUCT_OPTIONAL_FIELD.SYNC_STATUS` foi removido — o estado de sincronização
não é um campo que o host escolhe exibir, ele existe se e só se o host publica
na Meta, e duas fontes para a mesma decisão divergem. Quem usava aquele campo
passa a declarar `metaSync: { products: true, catalogs: false }`.
