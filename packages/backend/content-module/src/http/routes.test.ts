/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rotas reais sobre o adaptador fetch: escopo de admin, BOLA (sempre 404), público sem identidade
 * com cache, feed e sitemap por capacidade.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'
import type { AuthContextResolverPort } from '@adatechnology/module-http'
import type { ContentModuleConfig } from '@adatechnology/content-contracts'

import { buildTestModule } from '../testing/buildTestModule'
import { createContentRoutes } from './routes'

const COMPANY_A = randomUUID()
const COMPANY_B = randomUUID()
const FEED: ContentModuleConfig = { feed: { siteUrl: 'https://example.com', title: 'Novidades', language: 'pt-BR' } }

function setup(params: { scopes?: string[]; config?: ContentModuleConfig; withPublic?: boolean } = {}) {
  const { module, store, clock } = buildTestModule(params.config ? { config: params.config } : {})
  const authResolver: AuthContextResolverPort = {
    async resolve({ headers }) {
      const companyId = headers['x-company']
      return companyId ? { companyId, scopes: params.scopes ?? ['content:admin'] } : undefined
    },
  }
  const routes = createContentRoutes({
    module,
    ...(params.withPublic === false
      ? {}
      : {
          publicCompanyResolver: {
            resolve: async ({ headers }) => (headers.host === 'blog.a.test' ? COMPANY_A : undefined),
          },
        }),
  })
  const router = createModuleFetchRouter({ routes, basePath: '/v1', authResolver })
  const call = (path: string, init: RequestInit & { company?: string; host?: string } = {}) =>
    router.handle(
      new Request(`http://localhost/v1${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...(init.company ? { 'x-company': init.company } : {}),
          ...(init.host ? { host: init.host } : {}),
        },
      }),
    )
  return { module, store, clock, call, routes }
}

async function createAndPublish(call: ReturnType<typeof setup>['call'], title: string): Promise<string> {
  const created = await call('/posts', {
    method: 'POST',
    company: COMPANY_A,
    body: JSON.stringify({ title, body: '# Oi\n\ntexto' }),
  })
  const { data } = (await created.json()) as { data: { id: string } }
  await call(`/posts/${data.id}/publish`, { method: 'POST', company: COMPANY_A })
  return data.id
}

describe('admin', () => {
  it('sem identidade é 401; sem o escopo content:admin é 403', async () => {
    expect((await setup().call('/posts')).status).toBe(401)
    expect((await setup({ scopes: ['other'] }).call('/posts', { company: COMPANY_A })).status).toBe(403)
  })

  it('adminScopes vazio aceita identidade com algum escopo, nunca sessão sem escopo', async () => {
    const withScope = setup({ scopes: ['staff'], config: { adminScopes: [] } })
    expect((await withScope.call('/posts', { company: COMPANY_A })).status).toBe(200)
    const withoutScope = setup({ scopes: [], config: { adminScopes: [] } })
    expect((await withoutScope.call('/posts', { company: COMPANY_A })).status).toBe(403)
  })

  it('cria, edita, publica, lista e arquiva', async () => {
    const { call } = setup()
    const created = await call('/posts', {
      method: 'POST',
      company: COMPANY_A,
      body: JSON.stringify({ title: 'Olá mundo' }),
    })
    expect(created.status).toBe(201)
    const { data } = (await created.json()) as { data: { id: string; slug: string } }
    expect(data.slug).toBe('ola-mundo')

    const patched = await call(`/posts/${data.id}`, {
      method: 'PATCH',
      company: COMPANY_A,
      body: JSON.stringify({ excerpt: 'Resumo' }),
    })
    expect(patched.status).toBe(200)

    const published = await call(`/posts/${data.id}/publish`, {
      method: 'POST',
      company: COMPANY_A,
      body: JSON.stringify({ publishedAt: '2030-01-01T00:00:00.000Z' }),
    })
    expect(((await published.json()) as { data: { status: string } }).data.status).toBe('scheduled')

    const list = (await (await call('/posts?status=scheduled', { company: COMPANY_A })).json()) as {
      data: unknown[]
      pagination: { total: number }
    }
    expect(list.pagination.total).toBe(1)

    expect((await call(`/posts/${data.id}`, { method: 'DELETE', company: COMPANY_A })).status).toBe(204)
    expect((await call('/posts/tags', { company: COMPANY_A })).status).toBe(200)
  })

  it('corpo com campo desconhecido é 400', async () => {
    const { call } = setup()
    const response = await call('/posts', {
      method: 'POST',
      company: COMPANY_A,
      body: JSON.stringify({ title: 'a', status: 'published' }),
    })
    expect(response.status).toBe(400)
  })

  it('BOLA: post de outra empresa é 404 em toda operação e nada muda', async () => {
    const { call, store } = setup()
    const id = await createAndPublish(call, 'Da empresa A')
    for (const [path, method] of [
      [`/posts/${id}`, 'GET'],
      [`/posts/${id}`, 'PATCH'],
      [`/posts/${id}`, 'DELETE'],
      [`/posts/${id}/publish`, 'POST'],
      [`/posts/${id}/unpublish`, 'POST'],
    ] as const) {
      const response = await call(path, {
        method,
        company: COMPANY_B,
        ...(method === 'PATCH' ? { body: JSON.stringify({ title: 'x' }) } : {}),
      })
      expect(response.status).toBe(404)
    }
    expect(store.rows[0]?.title).toBe('Da empresa A')
    expect(store.rows[0]?.status).toBe('published')
  })

  it('rota de upload só existe com storage', async () => {
    const { routes } = setup()
    expect(routes.some((route) => route.operationId === 'uploadPostCoverImage')).toBe(false)
  })
})

describe('público', () => {
  it('lista e lê publicado sem identidade, com Cache-Control', async () => {
    const { call } = setup()
    await createAndPublish(call, 'Publicado')
    await call('/posts', { method: 'POST', company: COMPANY_A, body: JSON.stringify({ title: 'Rascunho' }) })

    const list = await call('/public/posts', { host: 'blog.a.test' })
    expect(list.status).toBe(200)
    expect(list.headers.get('cache-control')).toContain('public')
    const body = (await list.json()) as { data: { slug: string }[] }
    expect(body.data.map((post) => post.slug)).toEqual(['publicado'])

    expect((await call('/public/posts/publicado', { host: 'blog.a.test' })).status).toBe(200)
    expect((await call('/public/posts/rascunho', { host: 'blog.a.test' })).status).toBe(404)
    expect((await call('/public/tags', { host: 'blog.a.test' })).status).toBe(200)
  })

  it('empresa não resolvida é 404', async () => {
    const { call } = setup()
    await createAndPublish(call, 'Publicado')
    expect((await call('/public/posts/publicado', { host: 'outro.test' })).status).toBe(404)
  })

  it('sem resolver de empresa, as rotas públicas não existem', () => {
    const { routes } = setup({ withPublic: false })
    expect(routes.some((route) => route.path.startsWith('/public'))).toBe(false)
  })

  it('feed e sitemap só existem com config.feed', async () => {
    expect(setup().routes.some((route) => route.path === '/public/feed.xml')).toBe(false)

    const { call } = setup({ config: FEED })
    await createAndPublish(call, 'Post do feed')
    const rss = await call('/public/feed.xml', { host: 'blog.a.test' })
    expect(rss.headers.get('content-type')).toContain('application/rss+xml')
    const xml = await rss.text()
    expect(xml).toContain('<link>https://example.com/blog/post-feed</link>')
    expect(xml).toContain('&lt;h1&gt;Oi&lt;/h1&gt;')

    const atom = await call('/public/atom.xml', { host: 'blog.a.test' })
    expect(await atom.text()).toContain('<feed xmlns="http://www.w3.org/2005/Atom"')

    const sitemap = (await (await call('/public/sitemap-entries', { host: 'blog.a.test' })).json()) as {
      data: { loc: string }[]
    }
    expect(sitemap.data[0]?.loc).toBe('https://example.com/blog/post-feed')
  })
})

describe('agendamento, modelos e recorrência (rotas)', () => {
  const post = (call: ReturnType<typeof setup>['call'], path: string, body: unknown = {}, company = COMPANY_A) =>
    call(path, { method: 'POST', company, body: JSON.stringify(body) })
  const data = async <TData>(response: Response): Promise<TData> => ((await response.json()) as { data: TData }).data

  it('contagens, modelo, novo a partir de modelo e republicar', async () => {
    const { call } = setup()
    const id = await createAndPublish(call, 'Resumo')
    const template = await data<{ id: string; isTemplate: boolean }>(await post(call, `/posts/${id}/save-as-template`))
    expect(template.isTemplate).toBe(true)

    const counts = await data<Record<string, number>>(await call('/posts/counts', { company: COMPANY_A }))
    expect(counts).toMatchObject({ published: 1, templates: 1, draft: 0 })

    const templates = (await (await call('/posts?isTemplate=true', { company: COMPANY_A })).json()) as {
      data: { id: string }[]
    }
    expect(templates.data.map((entry) => entry.id)).toEqual([template.id])

    const fromTemplate = await post(call, `/posts/${template.id}/from-template`, { title: 'Novo' })
    expect(fromTemplate.status).toBe(201)
    expect((await post(call, `/posts/${id}/from-template`)).status).toBe(422)
    expect((await post(call, `/posts/${template.id}/publish`)).status).toBe(422)

    expect((await post(call, `/posts/${id}/republish`)).status).toBe(200)
    expect((await post(call, `/posts/${id}/republish`, { publishedAt: '2099-01-01T00:00:00.000Z' })).status).toBe(422)
    expect((await post(call, `/posts/${id}/republish`, {}, COMPANY_B)).status).toBe(404)
  })

  it('CRUD de recorrência, isolado por empresa', async () => {
    const { call } = setup()
    const id = await createAndPublish(call, 'Resumo')
    const template = await data<{ id: string }>(await post(call, `/posts/${id}/save-as-template`))
    const created = await post(call, '/recurrences', {
      templateId: template.id,
      frequency: 'weekly',
      startsAt: '2026-12-01T10:00:00.000Z',
    })
    expect(created.status).toBe(201)
    const rule = await data<{ id: string; templateTitle: string }>(created)
    expect(rule.templateTitle).toBe('Resumo')
    expect(
      (await post(call, '/recurrences', { templateId: id, frequency: 'weekly', startsAt: '2026-12-01T10:00:00.000Z' }))
        .status,
    ).toBe(422)

    const list = await data<unknown[]>(await call('/recurrences', { company: COMPANY_A }))
    expect(list).toHaveLength(1)
    expect(await data<unknown[]>(await call('/recurrences', { company: COMPANY_B }))).toHaveLength(0)

    const patch = (company: string) =>
      call(`/recurrences/${rule.id}`, { method: 'PATCH', company, body: JSON.stringify({ isActive: false }) })
    expect((await patch(COMPANY_B)).status).toBe(404)
    expect((await patch(COMPANY_A)).status).toBe(200)
    expect((await call(`/recurrences/${rule.id}`, { method: 'DELETE', company: COMPANY_B })).status).toBe(404)
    expect((await call(`/recurrences/${rule.id}`, { method: 'DELETE', company: COMPANY_A })).status).toBe(204)
  })

  it('rotas novas exigem o escopo de admin', async () => {
    const { call } = setup({ scopes: ['other'] })
    expect((await call('/posts/counts', { company: COMPANY_A })).status).toBe(403)
    expect((await call('/recurrences', { company: COMPANY_A })).status).toBe(403)
  })
})
