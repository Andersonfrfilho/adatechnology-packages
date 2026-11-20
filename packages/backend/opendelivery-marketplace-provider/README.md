# @adatechnology/opendelivery-marketplace-provider

Conector do padrão Open Delivery (Abrasel) para `@adatechnology/marketplace-contracts`. Serve para qualquer
plataforma do padrão: muda só a URL, as credenciais e o nome da plataforma.

- Token OAuth (client credentials) em cache, polling de eventos com acknowledgment, detalhe do pedido.
- Ações: confirmar, preparando, pronto, despachar, entregue, retirado; cancelamento com os códigos do padrão.
- Webhook com `X-App-Signature` (HMAC-SHA256, hex ou base64).
- Sem negociação, financeiro ou avaliações (o padrão não tem).

```ts
import { OpenDeliveryMarketplaceProvider } from '@adatechnology/opendelivery-marketplace-provider'

const provider = new OpenDeliveryMarketplaceProvider({
  platform: '99food',
  baseUrl: 'https://<api-da-plataforma>/opendelivery',
  clientId,
  clientSecret,
  merchantIds: ['<loja>'],
})
```
