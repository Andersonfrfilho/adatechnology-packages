# @adatechnology/payment-module

Pagamentos e assinaturas plugáveis: banco, webhook idempotente, plano da pessoa, checkout, cancelamento
e painel, atrás de provedores que você pluga.

```ts
import { createPaymentModule, createPaymentRoutes, runPaymentMigrations } from '@adatechnology/payment-module'
import { createHotmartPaymentProvider, readHotmartOfferCode } from '@adatechnology/hotmart-payment-provider'

const monthlyUrl = process.env.HOTMART_CHECKOUT_URL_MONTHLY!

const payments = createPaymentModule({
  db,
  config: {
    plans: [
      { code: 'free', name: 'Gratuito', interval: 'none', features: [], offers: [], isFree: true },
      {
        code: 'premium_monthly',
        name: 'Premium mensal',
        interval: 'month',
        features: ['premium'],
        offers: [{ provider: 'hotmart', offerCode: readHotmartOfferCode(monthlyUrl)!, checkoutUrl: monthlyUrl }],
      },
    ],
  },
  providers: [createHotmartPaymentProvider({ hottok: process.env.HOTMART_HOTTOK ?? '' })],
  customers, // CustomerResolverPort do host
})

const routes = createPaymentRoutes({ module: payments })
await payments.useCases.requireFeature({ customerRef: userId }, 'premium') // 402 sem o plano
```

Provedor novo: implemente `PaymentProviderPort` de `@adatechnology/payment-contracts`. Testes:
`@adatechnology/payment-module/testing` (`createInMemoryPaymentStore`, `createFakePaymentProvider`).

Veja `.specs/features/payment-trio/spec.md`.
