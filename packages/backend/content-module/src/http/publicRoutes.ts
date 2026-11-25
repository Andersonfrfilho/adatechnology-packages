/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rotas do site público. Sem identidade: a empresa vem do `PublicCompanyResolverPort` do host
 * (domínio, cabeçalho, empresa fixa…). Resolver sem resposta = 404, igual a post inexistente.
 */

import {
  DEFAULT_PUBLIC_CACHE_CONTROL,
  listPublishedPostsQuerySchema,
  PostNotFoundError,
  type ListPublishedPostsQuery,
} from '@adatechnology/content-contracts'
import type { HttpResult, ModuleRoute, RequestContext } from '@adatechnology/module-http'

import type { ContentModule } from '../ContentModule'
import { FEED_FORMAT } from '../use-cases/Feed.use-cases'
import { TAG_SCOPE } from '../use-cases/PublicPost.use-cases'

export interface PublicCompanyResolverPort {
  resolve(params: {
    readonly headers: Readonly<Record<string, string>>
    readonly query: Readonly<Record<string, string>>
  }): Promise<string | undefined>
}

const PUBLIC = { scope: 'public' as const }

export function buildPublicRoutes(params: {
  module: ContentModule
  companyResolver: PublicCompanyResolverPort
}): ModuleRoute[] {
  const { useCases } = params.module
  const cacheControl = params.module.config.publicCacheControl ?? DEFAULT_PUBLIC_CACHE_CONTROL
  const cached = (data: unknown): HttpResult => ({
    kind: 'json',
    status: 200,
    body: data,
    headers: { 'Cache-Control': cacheControl },
  })

  async function resolveCompany(context: RequestContext): Promise<string> {
    const companyId = await params.companyResolver.resolve({ headers: context.headers, query: context.query })
    if (!companyId) throw new PostNotFoundError('company')
    return companyId
  }

  const routes: ModuleRoute[] = [
    {
      ...PUBLIC,
      method: 'GET',
      path: '/public/posts',
      querySchema: listPublishedPostsQuerySchema,
      operationId: 'listPublishedPosts',
      summary: 'Posts publicados, mais recentes primeiro, com filtro por tag',
      async handler(context) {
        const result = await useCases.listPublishedPosts.execute({
          companyId: await resolveCompany(context),
          ...(context.query as unknown as ListPublishedPostsQuery),
        })
        return cached(result)
      },
    },
    {
      ...PUBLIC,
      method: 'GET',
      path: '/public/posts/:slug',
      operationId: 'getPublishedPost',
      summary: 'Post publicado pelo slug; rascunho, agendado futuro e arquivado respondem 404',
      async handler(context) {
        const post = await useCases.getPublishedPostBySlug.execute({
          companyId: await resolveCompany(context),
          slug: context.params.slug ?? '',
        })
        return cached({ data: post })
      },
    },
    {
      ...PUBLIC,
      method: 'GET',
      path: '/public/tags',
      operationId: 'listPublishedTags',
      summary: 'Tags dos posts publicados, com contagem',
      async handler(context) {
        const tags = await useCases.listTags.execute({
          companyId: await resolveCompany(context),
          scope: TAG_SCOPE.PUBLIC,
        })
        return cached({ data: tags })
      },
    },
  ]

  const { buildFeed, listSitemapEntries } = useCases
  if (!buildFeed || !listSitemapEntries) return routes

  const feedRoute = (path: string, format: 'rss' | 'atom', contentType: string, operationId: string): ModuleRoute => ({
    ...PUBLIC,
    method: 'GET',
    path,
    operationId,
    summary: `Feed ${format.toUpperCase()} dos posts publicados`,
    async handler(context) {
      const body = await buildFeed.execute({ companyId: await resolveCompany(context), format })
      return {
        kind: 'text',
        status: 200,
        body,
        headers: { 'Content-Type': contentType, 'Cache-Control': cacheControl },
      }
    },
  })

  return [
    ...routes,
    feedRoute('/public/feed.xml', FEED_FORMAT.RSS, 'application/rss+xml; charset=utf-8', 'getRssFeed'),
    feedRoute('/public/atom.xml', FEED_FORMAT.ATOM, 'application/atom+xml; charset=utf-8', 'getAtomFeed'),
    {
      ...PUBLIC,
      method: 'GET',
      path: '/public/sitemap-entries',
      operationId: 'listSitemapEntries',
      summary: 'Entradas de sitemap (loc, lastmod) dos posts publicados, para o host juntar ao sitemap dele',
      async handler(context) {
        return cached({ data: await listSitemapEntries.execute({ companyId: await resolveCompany(context) }) })
      },
    },
  ]
}
