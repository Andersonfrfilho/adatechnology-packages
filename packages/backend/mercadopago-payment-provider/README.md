# @adatechnology/mercadopago-payment-provider

Plugin Mercado Pago do trio de pagamentos (`payment-contracts`). Gera cobrança avulsa e traduz o webhook.

- **Pix**: `createCharge({ kind: 'pix', ... })` devolve copia-e-cola, QR em base64 e link do ticket.
- **Link de cartão**: `createCharge({ kind: 'payment_link', ... })` devolve o `init_point` (sem boleto, à vista).
- **Webhook**: confere o `x-signature` (HMAC-SHA256 com a assinatura secreta da aplicação) e busca o
  estado em `GET /v1/payments/:id` com o token da conta. `eventId` = `<id>:<status>` (idempotente).
- **Uma instância por conta**: o access token é de quem recebe. Em produto multiempresa, crie um
  provedor por empresa; o dinheiro cai direto na conta dela.

```ts
import { createMercadoPagoPaymentProvider } from '@adatechnology/mercadopago-payment-provider'

const provider = createMercadoPagoPaymentProvider({
  accessToken: establishment.mercadoPagoAccessToken, // APP_USR-... (ou TEST-... no sandbox)
  webhookSecret: establishment.mercadoPagoWebhookSecret,
  fallbackPayerEmail: establishment.email, // o Pix exige e-mail do pagador
})

const charge = await provider.createCharge({
  kind: 'pix',
  amount: { cents: 5790, currency: 'BRL' },
  reference: order.id,
  description: `Pedido #${order.number}`,
  idempotencyKey: `order-${order.id}-pix`,
  expiresAt: new Date(Date.now() + 30 * 60_000),
  notificationUrl: `https://api.exemplo.com/webhooks/payments/mercadopago/${establishment.id}`,
})

// no webhook
const event = await provider.parseWebhook({ headers, rawBody })
if (event.type === 'payment_approved') markPaid(event.customerRef)
```

Testes: `bun test` (API simulada com `fetch` injetado; nada fala com o Mercado Pago).
