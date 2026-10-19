/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rota de restauração e catálogo mesclado, pelas rotas REAIS do módulo.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { AuthContextResolverPort } from '@adatechnology/module-http'
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'
import {
  STANDARD_EMAIL_BUILTIN_TEMPLATE,
  STANDARD_EMAIL_TEMPLATE_KEY,
  STANDARD_EMAIL_VARIABLES,
} from '@adatechnology/notification-contracts'

import type { NotificationModule } from '../NotificationModule'
import type { TemplateRepository } from '../repositories/TemplateRepository'
import { buildTemplateRow, createInMemoryTemplates } from '../testing/inMemoryRepositories'
import { StandardEmailService } from '../use-cases/StandardEmail.use-cases'
import { DeactivateTemplateUseCase, ListTemplatesUseCase, UpsertTemplateUseCase } from '../use-cases/Template.use-cases'
import { createNotificationRoutes } from './routes'

const COMPANY = randomUUID()
const OTHER_COMPANY = randomUUID()
const HOST_CATALOG = { 'order.ready': [{ name: 'orderNumber', example: '1', required: true }] }

function build(seed = [] as ReturnType<typeof buildTemplateRow>[]) {
  const store = createInMemoryTemplates(seed)
  const repository = store as unknown as TemplateRepository
  const catalog = { ...HOST_CATALOG, [STANDARD_EMAIL_TEMPLATE_KEY]: STANDARD_EMAIL_VARIABLES }
  const module = {
    useCases: {
      listTemplates: new ListTemplatesUseCase(repository),
      upsertTemplate: new UpsertTemplateUseCase(repository, catalog),
      deactivateTemplate: new DeactivateTemplateUseCase(repository),
    },
    standardEmail: new StandardEmailService(repository),
    templateVariables: catalog,
  } as unknown as NotificationModule
  const authResolver: AuthContextResolverPort = {
    async resolve() {
      return { companyId: COMPANY, userId: randomUUID(), scopes: [] }
    },
  }
  const router = createModuleFetchRouter({
    routes: createNotificationRoutes({ module }),
    basePath: '/v1',
    authResolver,
  })
  return { store, router }
}

const standardRow = (overrides = {}) =>
  buildTemplateRow({
    companyId: COMPANY,
    key: STANDARD_EMAIL_TEMPLATE_KEY,
    channel: 'email',
    body: 'editado',
    ...overrides,
  })

describe('POST /notification-templates/:id/restore-default', () => {
  it('grava versão nova com o embutido e responde 201', async () => {
    const edited = standardRow()
    const { router, store } = build([edited])

    const response = await router.handle(
      new Request(`http://localhost/v1/notification-templates/${edited.id}/restore-default`, { method: 'POST' }),
    )
    const payload = (await response.json()) as { data: { version: number; body: string } & Record<string, unknown> }

    expect(response.status).toBe(201)
    expect(payload.data.version).toBe(2)
    expect(payload.data.body).toBe(STANDARD_EMAIL_BUILTIN_TEMPLATE.html)
    expect(store.rows).toHaveLength(2)
    // Forma que o `notification-client.restoreDefault` espera: `{ data: NotificationTemplate }`, sem outras chaves.
    expect(Object.keys(payload)).toEqual(['data'])
    expect(payload.data).toMatchObject({
      id: store.rows[1]?.id,
      key: STANDARD_EMAIL_TEMPLATE_KEY,
      channel: 'email',
      locale: 'pt-BR',
      active: true,
    })
  })

  it('id de outra chave ou de outra empresa é 404 e não grava nada', async () => {
    const otherKey = buildTemplateRow({ companyId: COMPANY, key: 'order.ready', channel: 'email' })
    const otherCompany = standardRow({ companyId: OTHER_COMPANY })
    const { router, store } = build([otherKey, otherCompany])

    for (const target of [otherKey, otherCompany]) {
      const response = await router.handle(
        new Request(`http://localhost/v1/notification-templates/${target.id}/restore-default`, { method: 'POST' }),
      )
      expect(response.status).toBe(404)
    }
    expect(store.rows).toHaveLength(2)
  })
})

describe('erros mapeados da chave padrão', () => {
  it('POST sem as obrigatórias → 400', async () => {
    const { router } = build()

    const response = await router.handle(
      new Request('http://localhost/v1/notification-templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: STANDARD_EMAIL_TEMPLATE_KEY,
          channel: 'email',
          locale: 'pt-BR',
          body: '<p>{{corpoMensagem}}</p>',
          active: true,
        }),
      }),
    )

    expect(response.status).toBe(400)
  })

  it('DELETE da chave → 409', async () => {
    const existing = standardRow()
    const { router } = build([existing])

    const response = await router.handle(
      new Request(`http://localhost/v1/notification-templates/${existing.id}`, { method: 'DELETE' }),
    )

    expect(response.status).toBe(409)
  })
})

describe('GET /notification-template-variables', () => {
  it('traz o catálogo do host e o do modelo padrão', async () => {
    const { router } = build()

    const response = await router.handle(new Request('http://localhost/v1/notification-template-variables'))
    const payload = (await response.json()) as { data: Record<string, { name: string }[]> }

    expect(Object.keys(payload.data).sort()).toEqual(['notification.standard-email', 'order.ready'])
    expect(payload.data[STANDARD_EMAIL_TEMPLATE_KEY]?.map((variable) => variable.name)).toContain('rodapePlataforma')
  })
})
