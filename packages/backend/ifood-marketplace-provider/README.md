# @adatechnology/ifood-marketplace-provider

Conector do iFood (Merchant API) para `@adatechnology/marketplace-contracts`.

- **Pedidos**: polling de eventos (até 100 lojas por chamada, `x-polling-merchants`) com acknowledgment, detalhe
  do pedido (itens com adicionais, pagamento com bandeira e troco, cupons com quem paga, CPF, mesa), webhook com
  `X-IFood-Signature` (HMAC-SHA256).
- **Ações**: aceitar, iniciar preparo, pronto, despachar; cancelamento com a lista de motivos que a API devolve.
- **Negociações** (HANDSHAKE_DISPUTE/SETTLEMENT): aceitar, recusar ou propor reembolso parcial ou mais tempo.
- **Financeiro** (Financial v3): vendas com bruto, lançamentos e líquido; repasses.
- **Avaliações** (Review v2): listar, resumo e responder; `policyUrl` é o link que o iFood exige na tela.
- Token renovado só quando vence, nova tentativa em 429/5xx e um novo login em 401.

```ts
import { IfoodMarketplaceProvider } from '@adatechnology/ifood-marketplace-provider'

const ifood = new IfoodMarketplaceProvider({ clientId, clientSecret, merchantIds: ['<merchantId>'] })
const events = await ifood.pollEvents()            // a cada 30 s
const order = await ifood.getOrder(events[0]!.orderId)
await ifood.acknowledge(events)
const sales = await ifood.financial.listSales('<merchantId>', { from: '2026-11-01', to: '2026-11-20' })
```
