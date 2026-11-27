---
'@adatechnology/coupon-contracts': minor
'@adatechnology/coupon-module': minor
'@adatechnology/coupons-ui': minor
'@adatechnology/module-http': minor
---

Novo trio de cupons e promoções: campanhas com desconto percentual ou fixo, código fixo, por lead ou em lote, campanha automática, validação com todos os motivos, resgate e liberação idempotentes pelo pedido (com a campanha travada), captação de contato com deduplicação e aceite, relatórios e exportação CSV/XLSX; telas do painel (`CampaignsWorkspace`) e do site (`CouponField`, `LeadCaptureDialog`, `CampaignBanner`). Migration inicial do schema `coupons` (journal `coupon_migrations`).

Segurança e LGPD: reenvio de código só para o contato guardado e com casamento exato; rotas públicas recusam sem IP, limitam também por campanha, respondem prévia recusada de forma genérica, mesmo status para cadastro novo e repetido, `Vary: Host` no cache; ids do caminho validados como UUID (404); anonimização de contato; aviso no boot sem gancho de auditoria da exportação. Banco recusa percentual acima de 100; a migration cria o schema só se faltar. Telas sem controle nativo e com o fuso da empresa nas datas.

`module-http`: resultado `binary` (arquivo para baixar, um `Content-Type` só também no uWS), `publicDetails` em erro de domínio devolvido em `error.details`, e `router.handle(request, { ip })` no adaptador fetch.
