---
'@adatechnology/coupon-contracts': minor
'@adatechnology/coupon-module': minor
'@adatechnology/coupons-ui': minor
---

Cupons com postgres.js: as condições de data usam os comparadores de coluna do Drizzle (o `Date` cru em `sql` quebrava com `ERR_INVALID_ARG_TYPE`); integração roda com Bun SQL e postgres.js.

Para hosts com reserva como pedido: `quoteCoupon` (`POST /coupons/quote`, desconto e total sem resgatar, por itens ou só subtotal); contatos por período (`from`/`to`, meio aberto) na lista, rota e exportação, com filtro de período no painel (slot `renderDateRangeInput`); `leadTag` por campanha entregue ao `onLeadCaptured`; campanha automática pode captar contato; captação responde `outcome` (`created`/`already-registered`) e `codeResent`; `leadReadScopes` dá só leitura de contatos e `CampaignsWorkspace readOnly`.

Migration nova `0001_lead_tag` (coluna `coupons.campaigns.lead_tag`, aditiva).
