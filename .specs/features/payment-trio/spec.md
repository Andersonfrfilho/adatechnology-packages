# Spec — Trio plugável `payment`

Cobrança por assinatura aparece em todo produto e cada um reescrevia o mesmo: webhook do provedor,
tabela de assinatura, "essa pessoa tem acesso?", tela de planos e painel de assinantes. O trio
separa o que é igual em todo produto do que muda de provedor para provedor.

## 1. Os três pacotes

| Pacote | O que tem | Depende de |
|---|---|---|
| `payment-contracts` | tipos, catálogo validado, máquina de estados, erros, portas | `zod` |
| `payment-module` | schema `payment`, migração, `PaymentStore`, casos de uso, rotas, `./testing` | contracts, `module-http`; `drizzle-orm` como peer |
| `<provedor>-payment-provider` | um plugin por provedor (o primeiro é `hotmart`) | só contracts |

Provedor novo = um pacote que implementa `PaymentProviderPort`. O módulo nunca conhece provedor pelo
nome; o host passa a lista em `createPaymentModule({ providers: [...] })`.

## 2. A porta do provedor

```ts
interface PaymentProviderPort {
  readonly name: string                       // vai para o banco e para /payments/webhooks/:provider
  readonly paymentMethods: readonly PaymentMethod[]
  isConfigured(): boolean                     // sem credencial → webhook 503
  parseWebhook(webhook): Promise<PaymentEvent> // autentica e traduz
  buildCheckoutUrl(params): string            // marca a pessoa no link
  cancelSubscription?(params): Promise<void>  // capacidade por ausência
}
```

O provedor traduz o evento dele para um dos tipos genéricos (`payment_approved`, `payment_pending`,
`payment_overdue`, `payment_failed`, `payment_refunded`, `payment_chargeback`,
`subscription_canceled`, `subscription_plan_changed`, `ignored`). O nome original fica em
`providerEventType`, só para auditoria.

## 3. Regras de acesso

| Situação | Libera? |
|---|---|
| `active` | sim |
| `past_due` | até 7 dias depois do fim do período (`pastDueGraceMs`) |
| `canceled` | até o fim do período pago |
| `pending`, `refunded` | não |

- Webhook é idempotente por `(provider, eventId)` e responde 200 também no repetido.
- Evento mais velho que o último aplicado não muda a assinatura (reembolso não é desfeito por uma
  aprovação atrasada).
- Oferta fora do catálogo libera `fallbackPlanCode` (padrão: o primeiro plano pago). Quem pagou nunca
  fica sem acesso por causa de configuração.

## 4. Quem pagou

1. `customerRef` no checkout (`xcod` na Hotmart) → `CustomerResolverPort.findByRef`.
2. E-mail da compra → `findByEmail`.
3. Sem conta ainda: a assinatura fica sem dono e é amarrada quando a pessoa entra, **só** se o host
   implementar `findEmailByRef` (ou passar o e-mail). O host só deve fazer isso se confirma e-mail no
   cadastro; sem confirmação, quem criar conta com o e-mail de outro comprador fica com a assinatura.

## 5. Rotas (`createPaymentRoutes`)

| Rota | Escopo |
|---|---|
| `POST /payments/webhooks/:provider` | público (o plugin autentica) |
| `GET /payments/plans`, `GET /payments/me` | pessoa logada |
| `POST /payments/me/cancel` | pessoa logada; só existe se algum provedor cancela |
| `GET /payments/admin/overview`, `/subscriptions`, `/events` | `payments:read` |

A pessoa é sempre `auth.userId`, nunca um id do corpo. O corpo cru do webhook não é guardado (tem CPF,
telefone e endereço).

## 6. Dados

Schema `payment`, migração convergente com tabela de controle `payment_migrations`.
`company_id` é nulo em single-tenant e fica reservado para multiempresa.

## 7. Testes

Nenhum teste chama provedor de verdade. `./testing` traz `createInMemoryPaymentStore` e
`createFakePaymentProvider`. O `DrizzlePaymentStore` roda contra Postgres quando
`PAYMENT_TEST_DATABASE_URL` existe.
