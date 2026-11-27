# @adatechnology/coupon-contracts

Contratos do trio de cupons e promoções (`coupon-contracts` / `coupon-module` / `coupons-ui`): tipos, schemas zod,
erros, portas e o avaliador puro de desconto. Isomórfico (Bun, Node, navegador), sem I/O.

## Instalação

```bash
bun add @adatechnology/coupon-contracts
```

## O que tem

- **Tipos**: `Campaign`, `CampaignListItem`, `PublicCampaign`, `Coupon`, `Lead`, `Redemption`, `OrderRef`, `CartItem`,
  `CouponValidation`, `CampaignReport`, `CaptureLeadResult`. Dinheiro sempre em centavos inteiros; datas em ISO 8601.
- **Schemas** (os mesmos no servidor e no formulário): `createCampaignSchema`, `updateCampaignSchema`,
  `listCampaignsQuerySchema`, `validateCouponSchema`, `publicValidateCouponSchema`, `findAutomaticSchema`,
  `redeemCouponSchema`, `releaseRedemptionSchema`, `captureLeadSchema`, `generateCodesSchema`, listas de leads,
  usos e códigos; `checkCampaignRules` para regras que cruzam campos.
- **Avaliador puro**: `evaluateCampaign({ campaign, items, at, usage, couponStatus?, customerRef?, requireCustomer? })`
  devolve `{ valid, discountCents, subtotalCents, eligibleSubtotalCents, reasons[] }` com **todos** os motivos de uma vez.
  Também `computeDiscountCents`, `isItemInScope`, `isCampaignOpen`, `campaignState`.
- **Erros** (`CouponError` e filhos) com `publicDetails` (campos recusados, motivos) que o `module-http` devolve em
  `error.details`; o resto de `details` fica só no log.
- **Portas**: `LeadNotifierPort`, `CustomerIdentityPort`, `RateLimiterPort`, `ClockPort`, `LoggerPort`, `CouponHooks`
  (`onCampaignChanged`, `onLeadCaptured`, `onRedeemed`, `onReleased`, `onExported` para auditoria).
- **Contato canônico**: `canonicalPhone` (só dígitos, com DDI; `(11) 98765-4321` e `+55 11 98765 4321` são o mesmo),
  `canonicalEmail`, `maskPhone` para log.
- **Código**: `normalizeCouponCode`, `generateCouponCode` (alfabeto sem 0/O/1/I), `cryptoRandomInt`.
- **Planilha sem dependência**: `buildCsv` (BOM, aspas, neutraliza fórmula — injeção de CSV), `buildXlsx` (XLSX de uma
  aba, texto como `inlineStr`, número como número).

## Regras do desconto

| Regra | Como funciona |
|---|---|
| Período | início inclusivo, fim exclusivo (`startsAt <= at < endsAt`) |
| Percentual | `round(elegível × valor / 100)`, meio centavo para cima |
| Fixo | o valor, nunca mais que o subtotal elegível |
| Teto | `maxDiscountCents` limita depois do cálculo |
| Mínimo | `minSubtotalCents` compara o subtotal **elegível** (o que está no escopo) |
| Escopo | todo o pedido, produtos, categorias ou etiquetas |
| Limites | total, por código e por cliente contam só usos ativos (`redeemed`) |
| Cliente | com limite por cliente, o resgate exige `customerRef`; a prévia do site não confere esse limite |
