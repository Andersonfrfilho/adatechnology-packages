# Spec — Trio plugável `meta-catalog`

Extração da capacidade Catálogo (Meta Commerce) em módulo plugável.
Companheira de `.specs/features/meta-whatsapp-trio/spec.md` — leia as duas juntas.
Regra de referência: `~/.claude/rules/rules/packages/pluggable-module.md`.

> **Status:** 🚧 Spec em revisão, junto com a do `meta-whatsapp-trio`.

---

## 1. Por que é trio separado

Esta é a separação **mais limpa** do ecossistema — e é o exemplo canônico citado na
própria regra de módulos plugáveis ("Catálogo ≠ WhatsApp").

Evidência levantada no `financiamento-imobiliario-bot` (branch `staging`):

| Evidência | Onde |
|---|---|
| **Zero FK** de `catalogs`/`products` para tabelas de conversa ou WhatsApp | `schema/catalogs.ts:15-27`, `schema/products.ts:15-40` — o único FK é `products.catalog_id → catalogs.id` |
| Os módulos de catálogo importam **zero** código de conversa | `modules/catalogs/**`, `modules/products/**` (~1.574 linhas) |
| A dependência é **unidirecional**: conversa → catálogo | ver §4 |
| O provider já isola a superfície | `whatsapp-provider/src/providers/WhatsAppCatalogProvider.ts` (205 linhas), classe separada de `WhatsAppMessageProvider`, exportada em `src/index.ts:43` |
| O catálogo aparece **sem WhatsApp nenhum** | QuickCart: loja web/PWA renderiza catálogo direto |

Ou seja: o catálogo já é independente na prática. A extração formaliza o que o código
já diz.

---

## 2. Escopo

### 2.1 GENÉRICO → `meta-catalog-*`

| Área | Origem |
|---|---|
| Schema `catalogs` (name, description, active, external_id, sync_status, sync_error, soft delete) | `schema/catalogs.ts:15-27` |
| Schema `products` (catalog_id, retailer_id único, name, description, price_in_cents, currency, image_url, image_storage_key, active, availability, condition, inventory, external_id, sync_status, sync_error, soft delete) | `schema/products.ts:15-40` |
| CRUD de catálogo + `RetryCatalogSync` | `modules/catalogs/**`, `CatalogRoutes.ts:17-22` |
| CRUD de produto + `BulkCreateProducts`, `UploadProductImage`, `ServeProductImage` | `modules/products/**`, `ProductRoutes.ts:17-24,30` |
| Webhook de catálogo (HMAC-verified) | `CatalogWebhookRoutes.ts:17-18` |
| Sync com Meta Graph | `CatalogSync.service.ts:24-36`, `ProductSync.service.ts:27-62` |
| Admin UI | `pages/CatalogsPage.tsx` (326 linhas), `pages/ProductsPage.tsx` (661 linhas) |

### 2.2 FICA NO PRODUTO

Curadoria de catálogo (quais produtos, preços, categorias), regras de estoque próprias
do negócio, e o conteúdo em si.

---

## 3. Anatomia

```
packages/backend/
├── meta-catalog-contracts/    @adatechnology/meta-catalog-contracts
└── meta-catalog-module/       @adatechnology/meta-catalog-module
packages/frontend/
└── meta-catalog-ui/           @adatechnology/meta-catalog-ui
```

`pgSchema('meta_catalog')`, journal `meta_catalog_migrations`.

### 3.1 Reorganização dos providers Meta (decidida)

> Decisão do usuário: o catálogo **não pertence ao pacote de WhatsApp, pertence ao
> Meta**. Rename autorizado.

Hoje tudo mora em `@adatechnology/whatsapp-provider` (v0.2.3):

```
whatsapp-provider/src/
├── providers/
│   ├── WhatsAppMessageProvider.ts    ← WhatsApp
│   ├── WhatsAppTemplateProvider.ts   ← WhatsApp
│   └── WhatsAppCatalogProvider.ts    ← NÃO é WhatsApp: é Meta Commerce
└── shared/
    ├── graphFetch.ts                 ← NÃO é WhatsApp: é Graph API genérica
    ├── assertConfigField.ts          ← genérico
    └── graphResponseSchemas.ts       ← genérico
```

Os três providers **compartilham** `graphFetch`/`assertConfigField`/`graphResponseSchemas`.
Logo, tirar o catálogo do pacote exige extrair também o encanamento comum — senão ele
seria duplicado.

**Layout alvo:**

```
packages/backend/
├── meta-graph-core/         @adatechnology/meta-graph-core        (NOVO)
│                            graphFetch · buildGraphUrl · assertConfigField
│                            graphResponseSchemas · MetaGraphError
│                            → fundação comum a qualquer API da Meta
├── meta-whatsapp-provider/  @adatechnology/meta-whatsapp-provider (RENOMEADO)
│                            messages + templates  ·  depende de meta-graph-core
└── meta-catalog-provider/   @adatechnology/meta-catalog-provider  (NOVO)
                             catalog + product sets · depende de meta-graph-core
```

**Dois renames, ambos autorizados:**

1. `WhatsAppCatalogProvider` → `MetaCatalogProvider`, movido para pacote próprio
2. `@adatechnology/whatsapp-provider` → `@adatechnology/meta-whatsapp-provider`,
   alinhando com a convenção da regra ("Produtos Meta: `meta-whatsapp-*`,
   `meta-catalog-*`")

**Custo:** major no provider atual + atualizar 4 `package.json`
(bot api/worker, quickcart api/worker). Baixo, e esses produtos já vão ser tocados na
migração de qualquer forma.

**Alternativa considerada e descartada:** colocar o cliente Graph de catálogo direto
dentro do `meta-catalog-module`, sem pacote de provider. Descartado por quebrar a
simetria já estabelecida no monorepo (provider = SDK stateless; module = stateful com
Drizzle/rotas/migrations), e porque um consumidor pode querer só o SDK de catálogo sem
banco.

---

## 4. A costura com conversa — `CatalogPort`

Três use-cases hoje moram em `modules/conversations` e dependem de catálogo:

| Use-case | O que faz | Direção |
|---|---|---|
| `SendProductList.use-case.ts:35-46` | Envia lista interativa `product_list`, com fallback para `catalog_message`. Lê `CatalogRepository` + `ProductRepository`, envia via `whatsAppProvider.messages` | conversa → catálogo |
| `HandleProductInquiry.use-case.ts:32-62` | Cliente pergunta sobre produto → lê `ProductRepository` → responde via `WhatsAppSender` | conversa → catálogo (leitura) |
| `HandleCatalogOrder.use-case.ts:45-96` | Pedido chega → decrementa `products.inventory`, deriva `availability`, chama `productSyncService.sync()` (`:87`) para empurrar de volta à Meta | conversa → catálogo (escrita) |

Os três **cortam no mesmo lugar**:

```
┌─────────────────────┬──────────────────────────┐
│ parte de CATÁLOGO   │ parte de CANAL           │
├─────────────────────┼──────────────────────────┤
│ buscar produtos     │ montar lista interativa  │
│ buscar 1 produto    │ formatar resposta        │
│ baixar estoque+sync │ parsear payload de order │
└─────────────────────┴──────────────────────────┘
```

**Desenho:** o `meta-whatsapp-module` declara um **`CatalogPort` opcional**:

```ts
type CatalogPort = {
  listProducts(params: ListProductsParams): Promise<CatalogProduct[]>
  findProductByRetailerId(retailerId: string): Promise<CatalogProduct | undefined>
  consumeInventory(params: ConsumeInventoryParams): Promise<void>
}
```

- Se o host **não** injeta `catalog`, os recursos de produto ficam desligados e o
  módulo de WhatsApp funciona normalmente.
- Se injeta, o `meta-catalog-module` fornece um adapter que satisfaz a porta.
- **Nenhum dos dois pacotes importa o outro.** Quem costura é o produto — exatamente o
  padrão descrito na regra.

Isso preserva a lógica valiosa dos três use-cases sem forçar todo consumidor de
WhatsApp a carregar catálogo, e sem forçar quem só quer catálogo a carregar WhatsApp.

---

## 5. Consumidores

| Produto | Uso |
|---|---|
| `financiamento-imobiliario-bot` | Catálogo Meta + lista interativa no WhatsApp (1º consumidor, migra primeiro) |
| `quickcart` | Catálogo é o **coração** do produto — loja web/PWA + carrinho por WhatsApp. Já tem `categories`/`products` próprios, que precisam ser reconciliados com o schema do módulo (ver §7) |

---

## 6. Lacunas conhecidas

- **Sem `items_batch` e sem ingestion sessions.** O sync atual é CRUD por item
  (`ProductSync.service.ts:64-67` tem inclusive uma nota sobre isso). Para catálogos
  grandes (supermercado do QuickCart), CRUD item-a-item não escala — a Meta oferece
  `items_batch` justamente para isso.
  → Implementar batch **é requisito do QuickCart**, não do bot.
  Referência da API: `packages/backend/meta-business/catalog/readme.md`.

---

## 7. Decisões abertas — `[NEEDS CLARIFICATION]`

**Q1. Como reconciliar o schema do módulo com o catálogo já existente do QuickCart?**
O QuickCart tem `categories` + `products` próprios (80 produtos seedados, com
`aliases` para resolução por linguagem natural, `unitSize`, `stockQuantity`). O módulo
traz `catalogs` + `products` com forma diferente (`retailer_id`, `availability`,
`condition`, `sync_status`).
→ *Opções:* (a) QuickCart migra para o schema do módulo e perde/adapta `aliases`;
(b) módulo ganha campos extensíveis (`metadata` jsonb) e o QuickCart guarda `aliases`
ali; (c) QuickCart mantém seu catálogo e usa o módulo só para *espelhar* na Meta.
→ *Recomendação:* **(c)** — o catálogo do QuickCart é fonte da verdade do negócio; o
módulo é o *sincronizador* com a Meta. Menos invasivo e respeita "regra de negócio do
produto fica no produto".

**Q2. O `meta-catalog-ui` reaproveita as telas do bot ou nasce do QuickCart?**
`CatalogsPage.tsx` (326) + `ProductsPage.tsx` (661) do bot são admin puro. O QuickCart
tem vitrine + admin.
→ *Recomendação:* módulo entrega **admin** (do bot) em headless + telas default; a
vitrine é do produto (é onde mora a identidade visual da loja).

**Q3. ✅ RESOLVIDA — catálogo sai do pacote de WhatsApp.**
Decisão do usuário. Ver o layout de providers em §3.1: `meta-graph-core` (fundação),
`meta-whatsapp-provider` (renomeado) e `meta-catalog-provider` (novo).

---

## 8. Critérios de aceite

- [ ] Trio publicado com semver e changeset
- [ ] `meta_catalog` pgSchema + journal próprio
- [ ] Zero `process.env` dentro dos pacotes
- [ ] Zero import de código de conversa/WhatsApp no módulo de catálogo
- [ ] `CatalogPort` declarado no `meta-whatsapp-module`, com adapter no
      `meta-catalog-module`; nenhum dos dois importa o outro
- [ ] Módulo de WhatsApp funciona **sem** catálogo injetado (recursos de produto off) —
      catálogo é **opcional** em qualquer projeto
- [ ] `meta-graph-core` publicado; `meta-whatsapp-provider` e `meta-catalog-provider`
      consumindo-o, sem duplicar o encanamento da Graph API
- [ ] Nenhum símbolo com prefixo `WhatsApp*` no pacote de catálogo
- [ ] Bot rodando sobre o SDK sem regressão
- [ ] QuickCart sincronizando catálogo com a Meta
- [ ] README de cada pacote
- [ ] Revisão final com `opus` antes de publicar
