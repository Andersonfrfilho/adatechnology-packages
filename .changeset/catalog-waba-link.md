---
'@adatechnology/meta-graph-core': patch
'@adatechnology/meta-catalog-provider': patch
---

Adiciona `MetaCatalogProvider.linkCatalogToWaba()`. `createCatalog()` só criava o catálogo no
Business Manager (`owned_product_catalogs`); sem o vínculo separado em `{waba}/product_catalogs`
exigido pela Graph API, o catálogo nunca aparecia em `listCatalogs()` e ficava órfão mesmo
existindo de verdade na Meta.
