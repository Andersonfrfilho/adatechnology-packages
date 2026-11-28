---
'@adatechnology/catalog-contracts': minor
'@adatechnology/catalog-module': minor
'@adatechnology/products-ui': minor
---

Produto ganha `orderEligibility` opcional (quem pode pedir): `{ minimumAge?: number | null (inteiro 0–21), audience?: 'everyone' | 'staying_guests' }`, guardado em `attributes.orderEligibility` (sem migration; produtos existentes não mudam). `catalog-contracts` exporta `productOrderEligibilitySchema`, `ORDER_AUDIENCE`, `ProductOrderEligibility` e valida a chave nos schemas de criar/atualizar produto. `products-ui` ganha `PRODUCT_OPTIONAL_FIELD.ORDER_ELIGIBILITY`, que liga a seção "Quem pode pedir" no `ProductForm` (idade mínima com atalho "18" e público Todos / Só hóspedes com estadia ativa); textos em `config.orderEligibilityLabels`.
