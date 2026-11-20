# @adatechnology/food99-marketplace-provider

Conector da 99Food no protocolo próprio dela (o que a 99Food recomenda) para
`@adatechnology/marketplace-contracts`. Para entrar pelo padrão Open Delivery, use
`@adatechnology/opendelivery-marketplace-provider`.

- Pedidos chegam por **webhook** assinado (não há polling); `parseWebhook` confere a assinatura e devolve os eventos.
- Token por loja (`app_shop_id`) em cache, renovado quando vence.
- Ids de 64 bits preservados como texto; valores em centavos convertidos para reais.
- Ações: confirmar, pronto, despachar e entregar (entrega da loja, com o entregador), concluir retirada.
- Cancelamento com os motivos aceitos; pedidos de cancelamento e de reembolso do cliente viram negociação.
- Financeiro: vendas com comissão e taxas, valor líquido e repasses (`provider.financial`).
- Sem avaliações (a 99Food não tem API para isso).

```ts
import { Food99MarketplaceProvider } from '@adatechnology/food99-marketplace-provider'

const provider = new Food99MarketplaceProvider({
  appId,
  appSecret,
  shopIds: ['<app_shop_id>'],
})

// No endpoint do webhook (corpo cru para a assinatura):
const events = provider.parseWebhook(rawBody, parsedBody)
```

Antes de produção, valide no ambiente de teste da 99Food (credenciais de teste do portal de desenvolvedor).
