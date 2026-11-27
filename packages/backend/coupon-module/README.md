# @adatechnology/coupon-module

Cupons e promoções plugáveis: campanhas com desconto percentual ou fixo, código **fixo**, **por lead** ou em **lote**,
campanha **automática** (sem código), validação, resgate e liberação **idempotentes pelo pedido**, captação de contato
com deduplicação, relatórios e exportação CSV/XLSX. Tabelas no schema Postgres `coupons`, journal próprio.

Tipos e schemas em [`@adatechnology/coupon-contracts`](../coupon-contracts); telas em
[`@adatechnology/coupons-ui`](../../frontend/coupons-ui).

## Instalação

```bash
bun add @adatechnology/coupon-module @adatechnology/coupon-contracts drizzle-orm
```

## Uso

```ts
import { createCouponModule, createCouponRoutes, runCouponMigrations } from '@adatechnology/coupon-module'
import { createModuleFetchRouter } from '@adatechnology/coupon-module/http/fetch'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

await runCouponMigrations({ db, migrate: (target, config) => migrate(target as never, config) })

const coupons = createCouponModule({
  db,
  config: { phoneCountryCode: '55' },
  providers: {
    logger,
    // Envia o código pelo modelo do notification-module (e-mail, WhatsApp).
    leadNotifier: { sendCoupon: (event) => notifications.send({ template: 'coupon-code', ...event }) },
    // Encontra ou cria o cliente do customer-module para o contato.
    customerIdentity: { resolve: ({ companyId, contact }) => customers.findOrCreate({ companyId, contact }) },
  },
  hooks: { onExported: (event) => audit.record('coupons.export', event) },
})

const router = createModuleFetchRouter({
  routes: createCouponRoutes({
    module: coupons,
    // Sem as duas portas as rotas públicas não sobem (fail-closed).
    public: { companyResolver: { resolve: async ({ headers }) => tenantFromHost(headers.host) }, rateLimiter },
  }),
  basePath: '/v1/coupons',
  authResolver,
})
```

No checkout/reserva, o **backend do host** resgata (o navegador nunca resgata direto):

```ts
const { redemption } = await coupons.useCases.redeemCoupon.execute({
  companyId,
  code: input.couponCode,              // ou campaignId de uma automática
  orderRef: { kind: 'reservation', id: reservation.id },
  items: [{ productId: pkg.id, categoryIds: [], tags: pkg.tags, priceCents: pkg.priceCents, quantity: 1 }],
  customerRef: customer.id,            // obrigatório se a campanha limita por cliente
})
// Pedido cancelado:
await coupons.useCases.releaseRedemption.execute({ companyId, orderRef: { kind: 'reservation', id } })
```

Repetir o resgate do mesmo pedido com o mesmo código devolve o resgate existente (`isNew: false`); outro código no mesmo
pedido é `409 COUPON_ORDER_ALREADY_REDEEMED`. Liberar duas vezes não desconta duas vezes. O resgate trava a linha da
campanha, então limites nunca estouram com pedidos simultâneos.

## Rotas

| Escopo | Método e caminho | O quê |
|---|---|---|
| admin | `GET /campaigns` | lista com busca, `state=running,scheduled,ended,inactive`, ordem, página e totais de uso |
| admin | `POST /campaigns`, `GET/PATCH/DELETE /campaigns/:id` | CRUD (apagar com histórico é 409: desative) |
| admin | `GET /campaigns/:id/report` | usos, liberações, desconto total, vendido, leads e códigos |
| admin | `POST/GET /campaigns/:id/codes`, `PATCH /campaigns/:id/codes/:codeId` | gerar lote, listar, ativar/desativar código |
| admin | `GET /campaigns/:id/leads`, `GET /campaigns/:id/redemptions` | contatos e usos paginados |
| admin | `GET /campaigns/:id/{leads,redemptions,codes}/export?format=csv\|xlsx` | todos os resultados do filtro, arquivo para baixar |
| service | `POST /coupons/validate`, `POST /coupons/automatic` | prévia do desconto; melhor automática do carrinho |
| service | `POST /redemptions`, `POST /redemptions/release` | resgate (201/200) e liberação idempotentes |
| public | `GET /public/campaigns`, `GET /public/campaigns/:id` | banner (sem código, limite nem contagem) |
| public | `POST /public/coupons/validate` | prévia anônima, **com limitador** |
| public | `POST /public/campaigns/:id/leads` | captação, **com limitador** (201 novo / 200 repetido) |

Escopos padrão: `coupons:admin` (painel) e `coupons:service` ou `coupons:admin` (serviço); troque em `config`.
Recusas vêm com `error.details`: `{ reasons: [...] }` no resgate, `{ fields: [{ field, message }] }` em formulário.

## Captação de contato

- Campos pedidos por campanha (`off`/`optional`/`required`); telefone ou e-mail obrigatório, aceite (LGPD) obrigatório
  e guardado com o texto aceito.
- Deduplicação por telefone **e** e-mail canônicos na campanha (índice único). Repetir o cadastro não cria lead nem
  código; no modo fixo a resposta traz o código (é público), nos outros só o dono recebe de novo pelo `leadNotifier`.
- Lote: entrega o próximo código livre com `FOR UPDATE SKIP LOCKED`; lote vazio desfaz o cadastro (`409 CODES_EXHAUSTED`).
- `leadNotifier`, `customerIdentity` e ganchos rodam depois do commit; falha neles é logada e não desfaz o cadastro.

## Portas

| Porta | Para quê | Ausente |
|---|---|---|
| `leadNotifier` | entregar o código (use o modelo do `notification-module`) | código só na tela |
| `customerIdentity` | ligar o lead ao cliente do host (`customerRef`) | lead sem cliente |
| `rateLimiter` (rotas) | limitar prévia e captação anônimas | rotas públicas não sobem |
| `persistence` | trocar o Drizzle (dublê em memória nos testes do host) | Drizzle sobre `db` |
| `hooks.onExported` | trilha de auditoria da exportação | só o log |

Logs nunca levam telefone, e-mail, nome nem código: só ids opacos e contagens.

## Exportação

`exportCampaignData` lê em páginas de 1.000 até 50.000 linhas e devolve o arquivo; o cabeçalho `X-Export-Truncated`
avisa quando o teto cortou. Dinheiro sai em reais como número (a planilha soma).

## Testes

```bash
bun test                                                   # unitários, rotas, SQL e isolamento por empresa
DRIZZLE_TEST_DATABASE_URL=postgres://... bun test          # + integração real (migrations, concorrência, SKIP LOCKED)
```
