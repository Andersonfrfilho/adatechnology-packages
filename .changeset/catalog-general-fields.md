---
'@adatechnology/catalog-contracts': minor
'@adatechnology/catalog-module': minor
'@adatechnology/products-ui': minor
---

Catálogo: preço sob consulta (`priceInCents: null`), agenda de disponibilidade por produto (dias da semana + janela de horário + fuso, com `isAvailableAt`, `isProductAvailable` e `listAvailableProducts`) e `attributes` livres com porta de validação do host. Migration `0002` (aditiva). `products-ui` ganha os campos opcionais `priceOnRequest`, `availabilitySchedule` e `attributes`.
