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

## Varejo físico

Quatro campos opcionais para quem tem loja e vende por conversa: `brand`, `unitSize` (o tamanho
como está no rótulo — "500g", "fardo 12un"), `aisle` e `aliases`.

`aisle` é **endereço de prateleira**, a placa pendurada no corredor, e não se confunde com
`sectionId`, que agrupa o catálogo (em restaurante, o posto de produção). Um item pode ter os dois.

`aliases` é como o cliente chama o produto ("miojo", "leite moça"). A busca casa `name` e `brand`
por trecho (índice GIN de trigrama nos dois) e **apelido inteiro**, em minúsculas: apelido já é o
termo curto que o cliente digitou, e casar pedaço dele devolveria o catálogo inteiro.

Os quatro chegam vazios em quem não os usa, e a busca se comporta como antes.

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

## Canal de conversa

```ts
whatsapp.setCatalogPort(catalog.lookup)
```

`lookup` usa a projeção de **cliente**: `costPriceInCents` não sai do banco nessas leituras.

## Licença

MIT © Ada Technology
