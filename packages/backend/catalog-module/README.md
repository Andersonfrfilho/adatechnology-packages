# @adatechnology/catalog-module

**Gerenciamento de catálogo e produtos** como módulo plugável: CRUD, seções, estoque, importação
em lote e publicação **opcional** na Meta Commerce. TypeScript, Drizzle + PostgreSQL, roda em Bun
e Node.

- Tabelas em `pgSchema('catalog')`, com migrations e journal próprios — nunca toca o `public` do host
- Rotas HTTP prontas para `Bun.serve` **e** uWebSockets.js
- Estoque com baixa atômica e teste de concorrência
- Multiempresa por construção, com teste de isolamento por renderização de SQL

A Meta é integração opcional e **desligada por padrão** — daí o pacote se chamar `catalog-*` e não
`meta-catalog-*`.

## Instalação

```bash
bun add @adatechnology/catalog-module @adatechnology/catalog-contracts
```

`drizzle-orm` é peer dependency. Para montar as rotas, adicione também
`@adatechnology/module-http`.

## Uso mínimo

```ts
import { createCatalogModule, runCatalogMigrations } from '@adatechnology/catalog-module'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

await runCatalogMigrations({ db, migrate })

const catalog = createCatalogModule({
  db,                                    // conexão do host — o módulo não abre nenhuma
  config: { currency: 'BRL', locale: 'pt-BR', deriveAvailabilityFromInventory: true },
})

const product = await catalog.useCases.createProduct.execute({
  companyId,
  name: 'Café torrado 500g',
  priceInCents: 2490,
  inventory: 40,
})
```

`companyId` vem sempre do contexto autenticado do host, nunca do corpo da requisição.

## Rotas prontas

```ts
import { createCatalogRoutes } from '@adatechnology/catalog-module'
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'

const http = createModuleFetchRouter({
  routes: createCatalogRoutes({ module: catalog }),
  basePath: '/v1',
  authResolver,          // devolve { companyId, userId, scopes } JÁ validado pelo host
})

// no router do host, antes do 404:
if (http.match(request)) return http.handle(request)
```

| Recurso | Rotas |
|---|---|
| Produtos | `GET/POST /products`, `GET/PUT/DELETE /products/:id`, `PUT /products/:id/inventory`, `POST /products/bulk-import` |
| Catálogos | `GET/POST /catalogs`, `PUT/DELETE /catalogs/:id` |
| Seções | `GET/POST /sections`, `PUT/DELETE /sections/:id` |

Para uWebSockets, troque por `mountModuleRoutes` de `@adatechnology/module-http/uws` — as duas
rotas passam pelo mesmo despachante, e há teste de paridade garantindo respostas idênticas.

Paths OpenAPI saem da mesma tabela:

```ts
import { catalogOpenApiPaths } from '@adatechnology/catalog-module/openapi'
const spec = buildOpenApiSpec({ extraPaths: catalogOpenApiPaths({ routes, basePath: '/v1' }) })
```

## Estoque

`consumeInventory` desce até um `UPDATE ... WHERE inventory >= quantity` com checagem de linhas
afetadas — dois pedidos simultâneos do último item **não passam os dois**. Ler o saldo e depois
gravar permitiria a corrida; o banco é o único lugar onde ela se resolve sem lock explícito.

`inventory: null` significa "não controlo estoque": o item nunca fica indisponível por saldo.

Com `deriveAvailabilityFromInventory`, chegar a zero derruba `availability` e dispara
`onProductOutOfStock` **na transição** — não a cada venda, senão o alerta de reposição viraria
ruído que o operador aprende a ignorar.

## Importação em lote

Recebe **linhas já extraídas**, não o arquivo: parsear XLSX exigiria uma dependência de ~7 MB que
só serve a quem importa planilha, e o host já tem parser.

```ts
const report = await catalog.useCases.bulkImportProducts.execute({ companyId, rows })
// { succeeded: 1180, failed: 3, errors: [{ row: 47, message: 'Preço não reconhecido: "cortesia"' }] }
```

Uma linha ruim não derruba as outras, e o número reportado é o da **planilha** (1 = cabeçalho) —
o que o operador vê ao abrir o arquivo para corrigir. Catálogos e seções mencionados que ainda não
existem são criados.

Preço aceita os formatos que aparecem de verdade: `19,90`, `19.90`, `R$ 19,90` e `1.299,90`.

## Publicação na Meta (opcional)

```ts
const catalog = createCatalogModule({
  db,
  config: { currency: 'BRL', locale: 'pt-BR', metaSync: { products: true, catalogs: false } },
  providers: { metaSync: metaSyncAdapter },   // adaptador sobre o meta-catalog-provider, no host
})

for (const schedule of catalog.schedules) {
  cron.register(schedule.name, schedule.cronExpression, () => schedule.run(companyId))
}
```

**Não há fila, e é decisão.** Catálogo muda quando um operador edita, tolera minutos de atraso e
ganha com lote — uma varredura por cron sobre `syncStatus = 'pending'` cobre o caso e evita exigir
broker. O `retriable` volta para `pending` sem backoff explícito: o intervalo do cron é o backoff.

Com `metaSync` desligado (o padrão), **as rotas de publicação nem são montadas**. Ligar sem
injetar a porta falha no boot.

O módulo **não importa** o `meta-catalog-provider` — o adaptador é escrito no host, para quem só
gerencia catálogo interno não carregar cliente de Graph API.

## Busca de produto por imagem (opcional)

Uma foto entra e vira produto, por uma cascata que para no primeiro degrau que decide: **código de
barras**, depois **vizinho mais próximo por vetor**, depois **desempate por modelo de visão**. Cada
degrau só roda porque o anterior não resolveu.

Desligada por padrão. Ligar são duas coisas — a porta e a migration:

```ts
import { createCatalogModule, runCatalogVisionMigrations } from '@adatechnology/catalog-module'

// A extensão `vector` não vem no Postgres padrão: esta migration tem journal próprio
// (`catalog_vision_migrations`) para que quem não usa busca visual não deixe de subir.
await runCatalogVisionMigrations({ db, migrate })

const catalog = createCatalogModule({
  db,
  config: { currency: 'BRL', locale: 'pt-BR' },
  providers: { vision },   // satisfeita por @adatechnology/product-vision-provider
})

const result = await catalog.useCases.identifyProductByImage?.execute({ companyId, bytes, mimeType })
```

`result` é uma união fechada, porque cada desfecho vira uma mensagem diferente no canal:

| `outcome` | Significa | O canal responde |
|---|---|---|
| `barcode` | GTIN lido e produto encontrado | Confirma o item |
| `matched` | O desempate escolheu | Confirma o item |
| `candidates` | Vizinhos acima do piso, sem desempate | Botões (≤3) ou lista (4+) |
| `unmatched` | Nada acima do piso, ou "nenhum destes" | Pede outra foto ou chama uma pessoa |

Sem `providers.vision`, `hasVision` é `false` e `identifyProductByImage` não existe — o canal não
oferece o affordance em vez de ganhar uma flag.

**A dimensão do vetor é fixa em 512** (CLIP ViT-B/32), porque o índice HNSW exige tamanho declarado
e migration não lê configuração. Provider que declare outra dimensão é recusado no boot, em vez de
gravar vetor truncado num índice que responderia produto errado para sempre.

O provider pode trazer só o leitor de código de barras: sem `embeddingModel`, não há índice
vetorial nem modelo de visão para subir, e a identificação funciona num catálogo sem foto nenhuma.

## Canal de conversa

```ts
whatsapp.setCatalogPort(catalog.lookup)
```

`lookup` usa a projeção de **cliente**: `costPriceInCents` não sai do banco nessas leituras.

## Licença

MIT © Ada Technology
