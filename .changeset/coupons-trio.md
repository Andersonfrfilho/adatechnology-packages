---
'@adatechnology/coupon-contracts': minor
'@adatechnology/coupon-module': minor
'@adatechnology/coupons-ui': minor
'@adatechnology/module-http': minor
---

Novo trio de cupons e promoções: campanhas com desconto percentual ou fixo, código fixo, por lead ou em lote, campanha automática, validação com todos os motivos, resgate e liberação idempotentes pelo pedido (com a campanha travada), captação de contato com deduplicação e aceite, relatórios e exportação CSV/XLSX; telas do painel (`CampaignsWorkspace`) e do site (`CouponField`, `LeadCaptureDialog`, `CampaignBanner`). Migration inicial do schema `coupons` (journal `coupon_migrations`).

`module-http`: resultado `binary` (arquivo para baixar) e `publicDetails` em erro de domínio, devolvido em `error.details`.
