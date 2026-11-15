---
'@adatechnology/payment-contracts': minor
'@adatechnology/mercadopago-payment-provider': minor
---

Estorno de cobrança avulsa: `refundCharge` (total ou parcial, com idempotência) e `supportsRefunds` no `ChargeProviderPort`, e a implementação no provedor Mercado Pago (`POST /v1/payments/:id/refunds`).
