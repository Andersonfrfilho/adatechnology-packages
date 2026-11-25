# @adatechnology/content-module

**Blog, novidades e notícias** como módulo plugável: posts em Markdown com slug, capa, tags, SEO,
rascunho, agendamento e arquivo; rotas de administração e públicas; RSS, Atom e sitemap.
TypeScript, Drizzle + PostgreSQL, roda em Bun e Node. Genérico: o vocabulário é "post", e cada app
chama como quiser.

- Tabela em `pgSchema('content')`, migrations com journal próprio (`content_migrations`) no formato
  clássico (`meta/_journal.json`) — nunca toca o `public` do host
- Multiempresa por construção (`companyId` em toda consulta), com teste de isolamento sobre o SQL
- Agendamento sem cron: o post fica público no instante de `publishedAt`
- Capacidade por ausência: sem storage não há upload; sem `config.feed` não há feed; sem resolver
  de empresa pública não há rota pública

## Instalação

```bash
bun add @adatechnology/content-module @adatechnology/content-contracts @adatechnology/module-http
```

`drizzle-orm` é peer dependency (`>=0.36.0 <1`, como o `catalog-module`).

## Uso

```ts
import { createContentModule, createContentRoutes, runContentMigrations } from '@adatechnology/content-module'
import { createModuleFetchRouter } from '@adatechnology/content-module/http/fetch'
import { contentOpenApiPaths } from '@adatechnology/content-module/openapi'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

await runContentMigrations({ db, migrate })

const content = createContentModule({
  db,
  config: {
    adminScopes: ['content:admin'],          // padrão; [] = qualquer identidade autenticada
    feed: { siteUrl: 'https://exemplo.com', title: 'Novidades', language: 'pt-BR', postPathTemplate: '/blog/{slug}' },
  },
  providers: {
    imageStorage,                            // opcional — mesma forma do ProductImageStoragePort do catálogo
    logger,
  },
  hooks: {
    onPostChanged: async ({ type, post }) => revalidatePath(`/blog/${post.slug}`), // opcional
  },
})

const http = createModuleFetchRouter({
  routes: createContentRoutes({
    module: content,
    // Como o site público diz de qual empresa é o blog. Ausente = sem rotas /public/*.
    publicCompanyResolver: { resolve: async ({ headers }) => companyIdByHost(headers.host) },
  }),
  basePath: '/v1/content',
  authResolver,                              // { companyId, userId?, scopes } já validado pelo host
})

if (http.match(request)) return http.handle(request)

const openApi = contentOpenApiPaths({ routes: http.routes, basePath: '/v1/content' })
```

Também há `@adatechnology/content-module/http/uws` para uWebSockets.js.

## Rotas

| Método | Caminho | Escopo | O que faz |
|---|---|---|---|
| GET | `/posts` | admin | lista (filtros `status`, `tag`, `search`; `page`, `pageSize` ≤ 100) |
| POST | `/posts` | admin | cria rascunho (slug gerado do título se omitido) |
| GET | `/posts/tags` | admin | tags de todos os posts, com contagem |
| POST | `/posts/cover-images` | admin | envia capa (bytes crus, `Content-Type` jpeg/png/webp, ≤ 1 MiB) — só com `imageStorage` |
| GET | `/posts/:id` | admin | lê |
| PATCH | `/posts/:id` | admin | edita (trocar título não troca o slug) |
| DELETE | `/posts/:id` | admin | arquiva (sai do site; slug continua reservado) |
| POST | `/posts/:id/publish` | admin | publica agora, ou agenda com `{ publishedAt }` futuro |
| POST | `/posts/:id/unpublish` | admin | volta a rascunho / cancela agendamento |
| GET | `/public/posts` | público | publicados, mais recentes primeiro (`tag`, `page`, `pageSize` ≤ 50) |
| GET | `/public/posts/:slug` | público | post publicado; rascunho, agendado futuro e arquivado = 404 |
| GET | `/public/tags` | público | tags dos publicados |
| GET | `/public/feed.xml` | público | RSS 2.0 — só com `config.feed` |
| GET | `/public/atom.xml` | público | Atom 1.0 — só com `config.feed` |
| GET | `/public/sitemap-entries` | público | `{ loc, lastmod }[]` para o host juntar ao sitemap dele — só com `config.feed` |

Respostas públicas saem com `Cache-Control` (`config.publicCacheControl`, padrão
`public, max-age=60, s-maxage=300, stale-while-revalidate=600`). Post de outra empresa responde 404
em toda rota, nunca 403.

## Portas

| Porta | Para quê | Ausente |
|---|---|---|
| `imageStorage: ContentImageStoragePort` | upload da capa | capa só por URL; rota de upload não sobe |
| `clock: ClockPort` | relógio do agendamento | relógio do sistema |
| `logger: LoggerPort` | falha de gancho | silêncio |
| `postStore: PostStorePort` | trocar a persistência (testes do host: `createInMemoryPostStore()`) | Drizzle sobre `db` |
| `hooks.onPostChanged` | purgar CDN, revalidar página estática | — (erro no gancho é logado e não desfaz a escrita) |

## Testes

`bun test` — use-cases (slug, agendamento, isolamento entre empresas, ganchos, capa), rotas reais
pelo adaptador fetch (escopo, BOLA, público, feed), SQL das condições e journal de migrations.
