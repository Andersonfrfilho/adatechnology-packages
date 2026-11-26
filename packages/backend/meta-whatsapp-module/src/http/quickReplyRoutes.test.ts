import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import {
  QuickReplyLimitReachedError,
  QuickReplyNotFoundError,
  QuickReplyShortcutTakenError,
  QUICK_REPLY_LIMITS,
} from '@adatechnology/meta-whatsapp-contracts'
import type { AuthContext, AuthContextResolverPort } from '@adatechnology/module-http'
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'

import type { QuickReplyRepository } from '../repositories/QuickReplyRepository'
import type { QuickReplyRow } from '../schema/schema'
import {
  CreateQuickReplyUseCase,
  DeleteQuickReplyUseCase,
  ListQuickRepliesUseCase,
  UpdateQuickReplyUseCase,
} from '../use-cases/QuickReply.use-cases'
import { createMetaWhatsAppQuickReplyRoutes } from './quickReplyRoutes'
import { QUICK_REPLY_SCOPE, type QuickReplyRouteScopes } from './quickReplyScope.constant'

const COMPANY_A = randomUUID()
const COMPANY_B = randomUUID()

/** Dublê em memória com as mesmas regras do repositório (escopo por empresa, atalho único, ordem, teto). */
class InMemoryQuickReplyRepository {
  readonly rows: QuickReplyRow[] = []

  async list(params: { companyId: string; search?: string }): Promise<QuickReplyRow[]> {
    const term = params.search?.toLowerCase()
    return this.rows
      .filter((row) => row.companyId === params.companyId)
      .filter((row) => !term || [row.title, row.shortcut, row.body].some((text) => text.toLowerCase().includes(term)))
      .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title))
  }

  async create(params: { companyId: string; title: string; shortcut: string; body: string; sortOrder?: number }) {
    const mine = this.rows.filter((row) => row.companyId === params.companyId)
    if (mine.length >= QUICK_REPLY_LIMITS.MAX_PER_COMPANY) throw new QuickReplyLimitReachedError(mine.length)
    if (mine.some((row) => row.shortcut === params.shortcut)) throw new QuickReplyShortcutTakenError(params.shortcut)
    const row: QuickReplyRow = {
      id: randomUUID(),
      companyId: params.companyId,
      title: params.title,
      shortcut: params.shortcut,
      body: params.body,
      sortOrder: params.sortOrder ?? mine.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.rows.push(row)
    return row
  }

  async update(params: { companyId: string; id: string; title: string; shortcut: string; body: string }) {
    const row = this.rows.find((item) => item.companyId === params.companyId && item.id === params.id)
    if (!row) throw new QuickReplyNotFoundError(params.id)
    const clash = this.rows.some(
      (item) => item.companyId === params.companyId && item.id !== params.id && item.shortcut === params.shortcut,
    )
    if (clash) throw new QuickReplyShortcutTakenError(params.shortcut)
    Object.assign(row, { title: params.title, shortcut: params.shortcut, body: params.body })
    return row
  }

  async delete(companyId: string, id: string): Promise<boolean> {
    const index = this.rows.findIndex((row) => row.companyId === companyId && row.id === id)
    if (index < 0) return false
    this.rows.splice(index, 1)
    return true
  }
}

function buildRouter(params: { auth: AuthContext | undefined; scopes?: QuickReplyRouteScopes }) {
  const repository = new InMemoryQuickReplyRepository()
  const real = repository as unknown as QuickReplyRepository
  const module = {
    quickReplies: {
      list: new ListQuickRepliesUseCase(real),
      create: new CreateQuickReplyUseCase(real),
      update: new UpdateQuickReplyUseCase(real),
      delete: new DeleteQuickReplyUseCase(real),
    },
  } as unknown as Parameters<typeof createMetaWhatsAppQuickReplyRoutes>[0]['module']
  const authResolver: AuthContextResolverPort = { resolve: async () => params.auth }
  return {
    repository,
    router: createModuleFetchRouter({
      routes: createMetaWhatsAppQuickReplyRoutes({ module, ...(params.scopes ? { scopes: params.scopes } : {}) }),
      basePath: '/v1',
      authResolver,
    }),
  }
}

const admin: AuthContext = { companyId: COMPANY_A, userId: 'u1', scopes: [QUICK_REPLY_SCOPE.WRITE] }
const agent: AuthContext = { companyId: COMPANY_A, userId: 'u2', scopes: ['agent'] }
const payload = { title: 'Boas-vindas', shortcut: 'ola', body: 'Olá, {{nome}}!' }

function send(router: ReturnType<typeof buildRouter>['router'], method: string, path: string, body?: unknown) {
  return router.handle(
    new Request(`http://localhost/v1${path}`, {
      method,
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    }),
  )
}

describe('rotas de respostas rápidas', () => {
  it('cria, lista, edita e apaga', async () => {
    const { router } = buildRouter({ auth: admin })

    const created = await send(router, 'POST', '/quick-replies', payload)
    expect(created.status).toBe(201)
    const { data } = (await created.json()) as { data: { id: string; shortcut: string } }
    expect(data.shortcut).toBe('ola')

    const listed = (await (await send(router, 'GET', '/quick-replies')).json()) as { data: { id: string }[] }
    expect(listed.data.map((item) => item.id)).toEqual([data.id])

    const edited = await send(router, 'PUT', `/quick-replies/${data.id}`, { ...payload, title: 'Saudação' })
    expect(edited.status).toBe(200)
    expect(((await edited.json()) as { data: { title: string } }).data.title).toBe('Saudação')

    expect((await send(router, 'DELETE', `/quick-replies/${data.id}`)).status).toBe(204)
    const empty = (await (await send(router, 'GET', '/quick-replies')).json()) as { data: unknown[] }
    expect(empty.data).toEqual([])
  })

  it('a ordem padrão é a de criação e a busca filtra título, atalho e texto', async () => {
    const { router } = buildRouter({ auth: admin })
    await send(router, 'POST', '/quick-replies', { ...payload, title: 'Zebra', shortcut: 'um' })
    await send(router, 'POST', '/quick-replies', { ...payload, title: 'Abelha', shortcut: 'dois', body: 'horário' })

    const all = (await (await send(router, 'GET', '/quick-replies')).json()) as { data: { shortcut: string }[] }
    expect(all.data.map((item) => item.shortcut)).toEqual(['um', 'dois'])

    const found = (await (await send(router, 'GET', '/quick-replies?search=hor')).json()) as {
      data: { shortcut: string }[]
    }
    expect(found.data.map((item) => item.shortcut)).toEqual(['dois'])
  })

  it('atalho repetido na empresa é 409 com o código que a tela reconhece', async () => {
    const { router } = buildRouter({ auth: admin })
    await send(router, 'POST', '/quick-replies', payload)
    const response = await send(router, 'POST', '/quick-replies', { ...payload, title: 'Outra' })
    expect(response.status).toBe(409)
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('QUICK_REPLY_SHORTCUT_TAKEN')
  })

  it('corpo inválido é 400 com todos os problemas de uma vez', async () => {
    const { router } = buildRouter({ auth: admin })
    const response = await send(router, 'POST', '/quick-replies', { title: '', shortcut: 'Com Espaço', body: '' })
    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { issues: { path: string }[] } }
    expect(body.error.issues.map((issue) => issue.path).sort()).toEqual(['body', 'shortcut', 'title'])
  })

  it('agente lê mas não escreve (403); sem identidade nada passa (401)', async () => {
    const { router } = buildRouter({ auth: agent })
    expect((await send(router, 'GET', '/quick-replies')).status).toBe(200)
    expect((await send(router, 'POST', '/quick-replies', payload)).status).toBe(403)
    expect((await send(router, 'PUT', `/quick-replies/${randomUUID()}`, payload)).status).toBe(403)
    expect((await send(router, 'DELETE', `/quick-replies/${randomUUID()}`)).status).toBe(403)

    const anonymous = buildRouter({ auth: undefined })
    expect((await send(anonymous.router, 'GET', '/quick-replies')).status).toBe(401)
  })

  it('o host troca os escopos de escrita e pode exigir escopo na leitura', async () => {
    const custom = buildRouter({
      auth: { companyId: COMPANY_A, userId: 'u3', scopes: ['admin'] },
      scopes: { write: ['admin'], read: ['admin', 'agent'] },
    })
    expect((await send(custom.router, 'POST', '/quick-replies', payload)).status).toBe(201)

    const noReadScope = buildRouter({
      auth: { companyId: COMPANY_A, userId: 'u4', scopes: ['other'] },
      scopes: { read: ['agent'] },
    })
    expect((await send(noReadScope.router, 'GET', '/quick-replies')).status).toBe(403)
  })

  it('resposta de outra empresa é 404 ao editar e ao apagar, e não aparece na lista', async () => {
    const { router, repository } = buildRouter({ auth: admin })
    const foreign = await repository.create({ companyId: COMPANY_B, ...payload })

    expect((await send(router, 'PUT', `/quick-replies/${foreign.id}`, payload)).status).toBe(404)
    expect((await send(router, 'DELETE', `/quick-replies/${foreign.id}`)).status).toBe(404)
    expect(repository.rows).toHaveLength(1)
    const listed = (await (await send(router, 'GET', '/quick-replies')).json()) as { data: unknown[] }
    expect(listed.data).toEqual([])
  })

  it('o companyId do corpo é ignorado: vale o da identidade', async () => {
    const { router, repository } = buildRouter({ auth: admin })
    await send(router, 'POST', '/quick-replies', { ...payload, companyId: COMPANY_B })
    expect(repository.rows[0]?.companyId).toBe(COMPANY_A)
  })

  it('empresa no teto recebe 422', async () => {
    const { router, repository } = buildRouter({ auth: admin })
    for (let index = 0; index < QUICK_REPLY_LIMITS.MAX_PER_COMPANY; index += 1) {
      await repository.create({ companyId: COMPANY_A, title: `t${index}`, shortcut: `a${index}`, body: 'x' })
    }
    const response = await send(router, 'POST', '/quick-replies', payload)
    expect(response.status).toBe(422)
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('QUICK_REPLY_LIMIT_REACHED')
  })
})
