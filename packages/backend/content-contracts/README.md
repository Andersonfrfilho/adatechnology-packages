# @adatechnology/content-contracts

Contratos do trio de **conteúdo** (blog, novidades, notícias, artigos): tipos, schemas zod, erros e
utilitários puros. Isomórfico — o mesmo código roda no servidor (`content-module`) e no navegador
(`content-ui`). Sem I/O, sem `process.env`.

## Instalação

```bash
bun add @adatechnology/content-contracts
```

## O que tem

| Área | Exportações |
|---|---|
| Tipos | `Post`, `PostSummary`, `PublicPost`, `PublicPostSummary`, `TagCount`, `Paginated`, `POST_STATUS` (`draft`, `scheduled`, `published`, `archived`) |
| Schemas | `createPostSchema`, `updatePostSchema`, `publishPostSchema`, `listPostsQuerySchema`, `listPublishedPostsQuerySchema`, `slugSchema`, `httpUrlSchema`, `POST_LIMITS` |
| Erros | `ContentError` (`statusCode` + `code` estável), `PostNotFoundError`, `DuplicateSlugError`, `InvalidCoverImageError`, … |
| Portas e config | `ContentImageStoragePort`, `ClockPort`, `LoggerPort`, `ContentHooks` (`onPostChanged`), `ContentModuleConfig`, `ContentFeedConfig` |
| Markdown seguro | `parseMarkdown` (Markdown → AST), `renderMarkdownToHtml`, `markdownToPlainText`, `sanitizeLinkUrl`, `sanitizeImageUrl` |
| Utilitários | `slugify`, `isValidSlug`, `normalizeTags`, `estimateReadingTimeMinutes`, `buildExcerpt` |
| Feed e sitemap | `buildRssFeed`, `buildAtomFeed`, `buildSitemapXml`, `buildPostUrl` |

## Markdown seguro

O corpo do post é Markdown, nunca HTML. O parser produz um AST **fechado** — não existe nó de HTML
cru —, então nenhum renderizador consegue emitir marcação digitada pelo autor:

- `<script>`, `<img onerror>`, `<iframe>` no texto viram texto escapado;
- link só com `http(s)`, `mailto`, `tel` ou caminho relativo (`javascript:`, `data:`, `vbscript:`
  e variações com tab/maiúsculas caem para texto);
- imagem só por `http(s)` ou caminho relativo;
- todo link sai com `rel="noopener noreferrer"`; link absoluto abre em nova aba (configurável);
- títulos ganham âncora (`id`) estável e podem ser deslocados de nível (`headingLevelOffset: 1`
  transforma `#` em `<h2>`, já que a página tem o `<h1>` do post).

Suportado: títulos, parágrafos, ênfase, negrito, tachado, código em linha e em bloco, listas
(inclusive aninhadas), citação, separador, link, imagem, autolink `<https://…>` e quebra de linha.

```ts
import { renderMarkdownToHtml, parseMarkdown } from '@adatechnology/content-contracts'

const html = renderMarkdownToHtml(post.body, { headingLevelOffset: 1 })   // string segura (SSR, feed, e-mail)
const ast = parseMarkdown(post.body)                                       // o content-ui renderiza em React, sem innerHTML
```

## Feed e sitemap sem o módulo

As funções são puras: um site estático pode gerar o RSS no build a partir da API pública.

```ts
buildRssFeed({ channel: { siteUrl, title, language: 'pt-BR' }, items })
buildSitemapXml(posts.map((post) => ({ loc: buildPostUrl({ siteUrl, slug: post.slug }), lastmod: post.updatedAt })))
```
