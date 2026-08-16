---
'@adatechnology/meta-catalog-provider': minor
'@adatechnology/meta-graph-core': minor
---

`MetaCatalogProvider.listProducts()` lista os itens de um catálogo (`{catalog}/products`),
seguindo a paginação do Graph até um teto de páginas.

Existe para reconciliação: comparar o que está gravado localmente com o que a conta realmente tem.
O `syncStatus` guardado numa tabela só conta como foi o último write — ele fica verde para sempre,
mesmo que o item tenha sido apagado no Commerce Manager. `getProduct` responderia a mesma pergunta
uma linha por vez, o que numa listagem vira dezenas de chamadas e esbarra em rate limit.
