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
| Produtos | `GET/POST /products`, `GET/PUT/DELETE /products/:id`, `PUT /products/:id/inventory`, `POST /products/bulk-import`, `GET /products/available?at=`, `GET /products/:id/availability?at=` |
| Catálogos | `GET/POST /catalogs`, `PUT/DELETE /catalogs/:id` |
| Seções | `GET/POST /sections`, `PUT/DELETE /sections/:id` |

### Escopos

| Rota | Escopo exigido (basta um) |
|---|---|
| `GET` (listar, detalhe, disponibilidade, seções, pendências de sync) | `catalog:read` ou `catalog:write` |
| Toda mutação (criar, editar, remover, estoque, importação, imagem, sync) | `catalog:write` |

Sem um deles a rota responde `403`; sem identidade, `401`. Se o vocabulário do host é outro, troque
na montagem — lista vazia aceita qualquer identidade que traga algum escopo:

```ts
createCatalogRoutes({ module: catalog, scopes: { read: ['admin', 'staff'], write: ['admin'] } })
```

⚠️ Até a 0.2.x as rotas `admin` não declaravam escopo e **qualquer identidade autenticada** lia e
escrevia o catálogo. Ao atualizar, o `authResolver` do host precisa devolver `catalog:read`/
`catalog:write` (ou o host passa `scopes`).

### Formato da listagem

`GET /products` e `GET /catalogs` respondem `{ data, pagination: { total, page, pageSize, totalPages } }`.
Cada produto traz `catalogName` quando tem catálogo, e cada catálogo traz `productCount` (produtos
não removidos). O `products-ui` lê esse formato direto com `createCatalogModuleProductsApi`.

Para uWebSockets, troque por `mountModuleRoutes` de `@adatechnology/module-http/uws` — as duas
rotas passam pelo mesmo despachante, e há teste de paridade garantindo respostas idênticas.

Paths OpenAPI saem da mesma tabela:

```ts
import { catalogOpenApiPaths } from '@adatechnology/catalog-module/openapi'
const spec = buildOpenApiSpec({ extraPaths: catalogOpenApiPaths({ routes, basePath: '/v1' }) })
```

## Preço sob consulta

`priceInCents: null` cadastra um produto sem valor publicado ("sob consulta"): ele é listado e
vendável, mas **não sobe para a Meta** (falha permanente `PRICE_ON_REQUEST`, até receber um preço).
`0` continua sendo preço (grátis). Linhas existentes não mudam: a migration só remove o `NOT NULL`.

```ts
await catalog.useCases.createProduct.execute({ companyId, name: 'Pacote de fim de semana', priceInCents: null })
await catalog.useCases.updateProduct.execute({ companyId, id, priceInCents: 90000 }) // define o preço
```

## Agenda de disponibilidade

Janela genérica por produto: dias da semana (0 = domingo) e, opcionalmente, `from`/`until`
(`HH:mm`, início inclusivo, fim exclusivo; `until < from` cruza a madrugada e pertence ao dia de
início), avaliada no fuso do próprio horário, ou em `config.defaultTimeZone`, ou em UTC.
`availabilitySchedule: null` remove a restrição.

```ts
const catalog = createCatalogModule({ db, config: { currency: 'BRL', locale: 'pt-BR', defaultTimeZone: 'America/Sao_Paulo' } })

await catalog.useCases.createProduct.execute({
  companyId, name: 'Prato do dia', priceInCents: 3200,
  availabilitySchedule: { weekdays: [1, 2, 3, 4, 5], from: '11:00', until: '15:00' },
})

await catalog.useCases.isProductAvailable.execute({ companyId, id, at: new Date() })
// { available: true } | { available: false, reason: 'inactive' | 'out_of_stock' | 'outside_schedule' }
await catalog.useCases.listAvailableProducts.execute({ companyId, at, catalogId })
```

"Disponível" = ativo **e** `availability` diferente de `out of stock` (pausar um item é gravar
`availability: 'out of stock'` ou `active: false`) **e** dentro da agenda. O avaliador puro também
é exportado do contracts (`isAvailableAt`) para uso no navegador.

## Atributos livres

`attributes` é um objeto jsonb (até 16 KB) que o módulo guarda sem interpretar — capacidade, "o que
inclui", alérgenos. O update **substitui** o objeto inteiro. A validação é do host:

```ts
createCatalogModule({ db, config, providers: {
  attributesValidator: { validate: ({ attributes }) => { if (typeof attributes.capacity !== 'number') throw new MyHostError() } },
} })
```

O erro do validador propaga como está. `attributes` sai também na projeção de cliente: não guarde
nada ali que o cliente final não possa ver.

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

**Um produto tem mais de um vetor.** A chave do índice é `(produto, modelo, origem)`: `catalog` é a
foto de estúdio — fundo branco, de frente, iluminada — e `feedback` é a foto real que um cliente
mandou e alguém confirmou ser aquele produto, com a embalagem amassada na mão e a luz do
supermercado. São imagens muito diferentes do mesmo objeto, e é por isso que o modelo genérico erra.

Guardar as duas é a especialização mais barata que existe: o índice aprende como os clientes daquela
loja fotografam, sem treinar nada. A busca deduplica por produto, então a conversa continua vendo
itens distintos e não o mesmo produto repetido.

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
