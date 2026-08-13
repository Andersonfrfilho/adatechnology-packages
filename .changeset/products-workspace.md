---
'@adatechnology/products-ui': minor
---

Adiciona `ProductsWorkspace`: a tela de catálogo composta (barra de catálogos, busca, listagem
paginada, formulário lateral e importação CSV), para o produto consumir a tela inteira em vez de
remontar o grid — que foi o que fez as telas divergirem antes.

Busca, filtro por catálogo e página vão para a API, não para a memória: filtrar em memória
mostrava "nenhum produto" para item que existia na página seguinte.
