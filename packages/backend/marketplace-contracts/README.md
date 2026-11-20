# @adatechnology/marketplace-contracts

Camada comum dos marketplaces de delivery (iFood, 99Food, Open Delivery). Só tipos e funções puras, sem I/O:
cada conector traduz a API da plataforma para estes tipos e o PDV não precisa saber de onde veio o pedido.

- **Porta `MarketplaceProvider`**: eventos (polling ou webhook), pedido, ações de status, motivos e pedido de
  cancelamento, negociações (cliente pede cancelamento, reembolso ou mais prazo), webhook assinado e, quando a
  plataforma tem, `financial` (vendas, taxas, repasses) e `reviews` (avaliações).
- **Status do PDV → plataforma** (`actionForStatus`, `actionsToSend`, `shouldSendAction`): só anda para a frente, aceita
  antes de tudo e manda "pronto" antes de "saiu para entrega" (regra de homologação do iFood).
- **HTTP** (`TokenCache`, `withRetry` para 429/5xx, `parseJsonKeepingBigInts` para ids de 64 bits, `MarketplaceApiError`).

```ts
import { actionForStatus, actionsToSend, type MarketplaceProvider } from '@adatechnology/marketplace-contracts'

const action = actionForStatus('ready', { deliveredBy: 'merchant', type: 'delivery' }) // 'readyForPickup'
for (const step of actionsToSend(link.platformStatus, action!)) {
  await provider.sendAction(link.externalId, step, { merchantId: link.merchantId })
}
```

Conectores: `@adatechnology/ifood-marketplace-provider`, `@adatechnology/opendelivery-marketplace-provider`.
