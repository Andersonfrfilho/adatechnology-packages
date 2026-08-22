---
'@adatechnology/scheduling-module': patch
---

Exporta `createSchedulingRoutes`

A tabela de rotas existia mas não saía do pacote: o host montava `createModuleFetchRouter` e não
tinha o que passar em `routes`. Sem ela, consumir o módulo por HTTP exigia reescrever as rotas no
produto — que é exatamente a cópia que o pacote existe para não ter.

Mesmo lugar do `createCatalogRoutes` no `catalog-module`, para o host importar do índice.
