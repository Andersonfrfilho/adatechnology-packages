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
    adminScopes: ['content:admin'],          // padrão; [] = qualquer identidade com ao menos um escopo
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
| GET | `/posts/counts` | admin | contagem por aba: `published`, `scheduled`, `draft`, `archived`, `templates` |
| POST | `/posts/:id/republish` | admin | muda a data de um post no ar **mantendo o mesmo endereço**; data futura é recusada (422) |
| POST | `/posts/:id/save-as-template` | admin | copia o post para um modelo (`{ title? }`); o original não muda |
| POST | `/posts/:id/from-template` | admin | cria rascunho novo a partir do modelo `:id` (`{ title?, slug? }`) |
| GET/POST | `/recurrences` | admin | lista / cria regra (`{ templateId, frequency: weekly\|monthly, startsAt }`) |
| PATCH/DELETE | `/recurrences/:id` | admin | pausa, retoma (`isActive`), remarca (`nextRunAt`) / apaga a regra (os posts ficam) |
| GET | `/public/posts` | público | publicados, mais recentes primeiro (`tag`, `page`, `pageSize` ≤ 50) |
| GET | `/public/posts/:ref` | público | `:ref` = `<shortId>-<slug>` (canônico), slug atual ou slug antigo; rascunho, agendado futuro e arquivado = 404 |
| GET | `/public/tags` | público | tags dos publicados |
| GET | `/public/feed.xml` | público | RSS 2.0 — só com `config.feed` |
| GET | `/public/atom.xml` | público | Atom 1.0 — só com `config.feed` |
| GET | `/public/sitemap-entries` | público | `{ loc, lastmod }[]` para o host juntar ao sitemap dele — só com `config.feed` |

Respostas públicas saem com `Cache-Control` (`config.publicCacheControl`, padrão
`public, max-age=60, s-maxage=300, stale-while-revalidate=600`). Post de outra empresa responde 404
em toda rota, nunca 403.

## Agendamento, modelos e recorrência

- **`publishDue({ now? })`** (`module.useCases.publishDue`): o host chama num intervalo. Marca como
  publicado o agendado vencido (e dispara `onPostChanged` `published`, para purgar cache) e materializa
  as recorrências vencidas. Idempotente e seguro com várias instâncias: o Postgres trava cada linha com
  `FOR UPDATE SKIP LOCKED`, então nenhum post é publicado nem notificado duas vezes. O agendamento já valia
  sem cron na leitura pública; o `publishDue` é o que faz o estado e os ganchos acontecerem na hora.
- **`startContentScheduler({ module, intervalMs?, logger? })`** chama o `publishDue` a cada minuto com guarda
  de execução única no processo e devolve a função que para o agendador (use no desligamento).
- **Modelo** = post com `isTemplate`. Nunca vai ao ar (publicar é 422), não aparece em `/posts` nem no
  site; a aba "Modelos" é `GET /posts?isTemplate=true`. O `canonicalUrl` não é copiado para o post novo.
- **Republicar** muda `publishedAt` do post no ar e dispara o evento `republished`. Escolha deliberada de SEO:
  o endereço **não muda** (duplicar com novo slug criaria conteúdo duplicado e deixaria o link antigo, com
  backlinks e indexação, apontando para a cópia velha). Data futura é recusada, porque tiraria o post do ar
  até lá (404 para leitor e buscador).
- **Recorrência** semanal ou mensal (UTC; mensal no dia 31 cai no fim dos meses curtos e volta ao 31): a
  cada vencimento, um post novo é publicado a partir do modelo, com slug `<titulo>-AAAA-MM-DD`. Servidor
  parado por semanas publica um post só ao voltar. Modelo apagado desativa a regra.
- **Migration `0001`** (aditiva): `posts.is_template`, `posts.short_id` (preenchido nos posts existentes),
  `posts.tag_labels`, `recurrence_rules`, `post_former_slugs` e índices parciais.

## Endereço do post

O endereço público é `<base>/<shortId>-<slug>`: o id curto (6 caracteres base36, único por empresa)
identifica o post; o slug é só legibilidade. A leitura (`/public/posts/:ref`) acha por id curto, depois por
slug atual e por slug antigo (`post_former_slugs`, gravado quando o slug é editado). O host compara
`buildPostRef(post)` com o pedido (`isCanonicalPostRef`) e responde **301** para o canônico quando diferem.
`buildPostPath` e `parsePostPath` (em `content-contracts`) montam e leem esse caminho. O slug automático é
curto: até 60 caracteres, sem acento, sem palavras de ligação do pt-BR, cortado em fronteira de palavra
(`config.slug = { maxLength, stopWords }` ajusta; `stopWords: false` mantém todas). No feed e no sitemap, use
`postPathTemplate: '/novidades/{shortId}-{slug}'`.

## Rótulos de tag

`post.tags` guarda a forma de URL; `post.tagLabels` guarda como o autor escreveu (`{ cardápio: 'Cardápio' }`),
preenchido a partir do texto digitado ou de `tagLabels` no corpo. Sem rótulo, a UI usa `formatTagLabel`
(primeira letra maiúscula, hífen vira espaço).

## Portas

| Porta | Para quê | Ausente |
|---|---|---|
| `imageStorage: ContentImageStoragePort` | upload da capa | capa só por URL; rota de upload não sobe |
| `clock: ClockPort` | relógio do agendamento | relógio do sistema |
| `logger: LoggerPort` | falha de gancho | silêncio |
| `recurrenceStore: RecurrenceStorePort` | trocar a persistência das regras (teste: `createInMemoryRecurrenceStore()`) | Drizzle sobre `db` |
| `postStore: PostStorePort` | trocar a persistência (testes do host: `createInMemoryPostStore()`) | Drizzle sobre `db` |
| `hooks.onPostChanged` | purgar CDN, revalidar página estática | — (erro no gancho é logado e não desfaz a escrita) |

## Testes

`bun test` — use-cases (slug, agendamento, isolamento entre empresas, ganchos, capa), rotas reais
pelo adaptador fetch (escopo, BOLA, público, feed), SQL das condições e journal de migrations.
