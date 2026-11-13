/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O modelo padrão de e-mail. Os repositórios são os dublês em memória do próprio pacote (o SQL
 * do `TemplateRepository` não tem teste com Postgres neste pacote); a corrida pela v1 é forçada
 * por um dublê que lê a versão ANTES de ceder, como o `upsert` real faz entre o select e o insert.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import {
  STANDARD_EMAIL_BUILTIN_TEMPLATE,
  STANDARD_EMAIL_TEMPLATE_KEY,
  STANDARD_EMAIL_VARIABLES,
} from '@adatechnology/notification-contracts'
import type { LoggerPort, StandardEmailInput } from '@adatechnology/notification-contracts'

import type { TemplateRepository } from '../repositories/TemplateRepository'
import type { TemplateRow } from '../schema/schema'
import { buildTemplateRow, createInMemoryTemplates } from '../testing/inMemoryRepositories'
import { StandardEmailTemplateInvalidError, StandardEmailTemplateRequiredError } from './StandardEmail.errors'
import { StandardEmailService } from './StandardEmail.use-cases'
import { DeactivateTemplateUseCase, UpsertTemplateUseCase } from './Template.use-cases'

const COMPANY = randomUUID()
const OTHER_COMPANY = randomUUID()
const IDENTITY = { key: STANDARD_EMAIL_TEMPLATE_KEY, channel: 'email', locale: 'pt-BR' } as const
const CATALOG = { [STANDARD_EMAIL_TEMPLATE_KEY]: STANDARD_EMAIL_VARIABLES }

const INPUT: StandardEmailInput = {
  attachments: [],
  bodyText: 'Olá',
  footer: { platformNote: 'Enviado pela plataforma' },
  identity: { displayName: 'Alfa Transportes', logo: { kind: 'initials' } },
  signer: { name: 'Maria da Silva' },
}

const USABLE_EDITED = `${STANDARD_EMAIL_BUILTIN_TEMPLATE.html}<!-- editado -->`

function setup(seed: TemplateRow[] = []) {
  const store = createInMemoryTemplates(seed)
  const repository = store as unknown as TemplateRepository
  const warnings: { message: string; meta?: Readonly<Record<string, unknown>> }[] = []
  const logger = {
    debug() {},
    info() {},
    warn: (message: string, meta?: Readonly<Record<string, unknown>>) => warnings.push({ message, meta }),
    error() {},
  } as LoggerPort
  return { store, repository, warnings, service: new StandardEmailService(repository, logger) }
}

const row = (overrides: Partial<TemplateRow> = {}) =>
  buildTemplateRow({ companyId: COMPANY, ...IDENTITY, body: USABLE_EDITED, ...overrides })

describe('standardEmail.ensureTemplate', () => {
  it('sem linha da chave grava a v1 com o embutido, ativa', async () => {
    const { service, store } = setup()

    expect(await service.ensureTemplate({ companyId: COMPANY })).toBe(true)

    expect(store.rows).toHaveLength(1)
    expect(store.rows[0]).toMatchObject({
      companyId: COMPANY,
      ...IDENTITY,
      version: 1,
      active: true,
      body: STANDARD_EMAIL_BUILTIN_TEMPLATE.html,
    })
  })

  it('a segunda chamada não grava nada', async () => {
    const { service, store } = setup()
    await service.ensureTemplate({ companyId: COMPANY })

    expect(await service.ensureTemplate({ companyId: COMPANY })).toBe(false)
    expect(store.rows).toHaveLength(1)
  })

  it('linha editada pela empresa não é sobrescrita', async () => {
    const { service, store } = setup([row({ version: 3 })])

    expect(await service.ensureTemplate({ companyId: COMPANY })).toBe(false)
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0]?.body).toBe(USABLE_EDITED)
  })

  it('linha desativada também conta como existente', async () => {
    const { service, store } = setup([row({ active: false })])

    expect(await service.ensureTemplate({ companyId: COMPANY })).toBe(false)
    expect(store.rows).toHaveLength(1)
  })

  it('a semente de uma empresa não conta para a outra', async () => {
    const { service, store } = setup([row({ companyId: OTHER_COMPANY })])

    expect(await service.ensureTemplate({ companyId: COMPANY })).toBe(true)
    expect(store.rows).toHaveLength(2)
  })

  it('duas chamadas concorrentes entre o existsIdentity e a gravação: uma grava a v1, a outra conta false (nunca v2)', async () => {
    const store = createInMemoryTemplates()
    const racing = {
      ...store,
      async existsIdentity(params: { companyId: string; key: string; channel: string; locale: string }) {
        const exists = await store.existsIdentity(params)
        await Promise.resolve() // as duas chamadas leem "não existe" antes de qualquer gravação
        await Promise.resolve()
        return exists
      },
    } as unknown as TemplateRepository
    const service = new StandardEmailService(racing)

    const results = await Promise.all([
      service.ensureTemplate({ companyId: COMPANY }),
      service.ensureTemplate({ companyId: COMPANY }),
    ])

    expect(results.filter(Boolean)).toHaveLength(1)
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0]?.version).toBe(1)
  })

  it('o índice único (empresa, chave, canal, locale, versão): inserir a mesma versão duas vezes dá 23505', async () => {
    const store = createInMemoryTemplates()
    const input = { companyId: COMPANY, ...IDENTITY, body: 'x', active: true, version: 1 }
    await store.insertVersion(input)

    await expect(store.insertVersion(input)).rejects.toMatchObject({ code: '23505' })
    expect(store.rows).toHaveLength(1)
  })

  it('o 23505 embrulhado em `cause` (erro do driver pelo Drizzle) também é "já existe"', async () => {
    const repository = {
      async existsIdentity() {
        return false
      },
      async insertVersion() {
        throw Object.assign(new Error('Failed query'), { cause: { code: '23505' } })
      },
    } as unknown as TemplateRepository

    expect(await new StandardEmailService(repository).ensureTemplate({ companyId: COMPANY })).toBe(false)
  })

  it('o 23505 no formato do driver do Bun (SQLSTATE em `errno`, `code` genérico) também é "já existe"', async () => {
    const bunError = (): Error =>
      Object.assign(new Error('duplicate key'), { code: 'ERR_POSTGRES_SERVER_ERROR', errno: '23505' })
    for (const thrown of [bunError(), Object.assign(new Error('Failed query'), { cause: bunError() })]) {
      const repository = {
        async existsIdentity() {
          return false
        },
        async insertVersion() {
          throw thrown
        },
      } as unknown as TemplateRepository

      expect(await new StandardEmailService(repository).ensureTemplate({ companyId: COMPANY })).toBe(false)
    }
  })

  it('outro erro do banco sobe', async () => {
    const repository = {
      async existsIdentity() {
        return false
      },
      async insertVersion() {
        throw new Error('connection lost')
      },
    } as unknown as TemplateRepository

    await expect(new StandardEmailService(repository).ensureTemplate({ companyId: COMPANY })).rejects.toThrow(
      'connection lost',
    )
  })
})

describe('standardEmail.resolveTemplate', () => {
  it('a versão ativa usável da empresa vence o embutido', async () => {
    const { service } = setup([row({ version: 2 })])

    expect(await service.resolveTemplate({ companyId: COMPANY })).toEqual({
      html: USABLE_EDITED,
      source: 'company',
      version: 2,
    })
  })

  it('sem linha ativa cai no embutido (versão 0) e registra o motivo, sem conteúdo', async () => {
    const { service, warnings } = setup([row({ active: false })])

    expect(await service.resolveTemplate({ companyId: COMPANY })).toBe(STANDARD_EMAIL_BUILTIN_TEMPLATE)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.message).toBe('standard_email_template_fallback')
    expect(warnings[0]?.meta).toMatchObject({ reason: 'missing', companyId: COMPANY })
    expect(JSON.stringify(warnings)).not.toContain('<table')
  })

  it('versão ativa inutilizável (falta obrigatória ou HTML inseguro) cai no embutido com reason unusable', async () => {
    const withoutRequired = row({ body: '<p>{{corpoMensagem}}</p>', version: 2 })
    const unsafe = row({ body: `${USABLE_EDITED}<script>x()</script>`, version: 3 })

    for (const broken of [withoutRequired, unsafe]) {
      const { service, warnings } = setup([broken])

      expect((await service.resolveTemplate({ companyId: COMPANY })).version).toBe(0)
      expect(warnings[0]?.meta).toMatchObject({ reason: 'unusable', templateId: broken.id, version: broken.version })
      expect(JSON.stringify(warnings)).not.toContain('script')
    }
  })

  it('o modelo de outra empresa não vaza', async () => {
    const { service } = setup([row({ companyId: OTHER_COMPANY, body: `${USABLE_EDITED}SEGREDO` })])

    const resolved = await service.resolveTemplate({ companyId: COMPANY })

    expect(resolved.source).toBe('builtin')
    expect(resolved.html).not.toContain('SEGREDO')
  })

  it('sem logger não quebra', async () => {
    const service = new StandardEmailService(setup().repository)

    expect((await service.resolveTemplate({ companyId: COMPANY })).source).toBe('builtin')
  })
})

describe('standardEmail.render', () => {
  it('resolve o modelo da empresa e renderiza', async () => {
    const { service } = setup([row({ version: 4 })])

    const rendered = await service.render({ companyId: COMPANY, input: INPUT })

    expect(rendered.template).toEqual({ key: STANDARD_EMAIL_TEMPLATE_KEY, source: 'company', version: 4 })
    expect(rendered.html).toContain('Alfa Transportes')
    expect(rendered.html).toContain('<!-- editado -->')
    expect(rendered.text).toContain('Maria da Silva')
  })

  it('sem modelo da empresa renderiza com o embutido', async () => {
    const { service } = setup()

    const rendered = await service.render({ companyId: COMPANY, input: INPUT })

    expect(rendered.template).toEqual({ key: STANDARD_EMAIL_TEMPLATE_KEY, source: 'builtin', version: 0 })
  })
})

describe('standardEmail.restoreDefault', () => {
  it('grava versão nova com o embutido e preserva o histórico', async () => {
    const { service, store } = setup([row({ version: 2 })])

    const restored = await service.restoreDefault({ companyId: COMPANY })

    expect(restored).toMatchObject({ key: STANDARD_EMAIL_TEMPLATE_KEY, version: 3, active: true })
    expect(restored.body).toBe(STANDARD_EMAIL_BUILTIN_TEMPLATE.html)
    expect(store.rows.map((each) => each.version)).toEqual([2, 3])
    expect(store.rows[0]?.body).toBe(USABLE_EDITED)
  })

  it('reativa o modelo depois de desativado', async () => {
    const { service } = setup([row({ active: false })])

    await service.restoreDefault({ companyId: COMPANY })

    expect((await service.resolveTemplate({ companyId: COMPANY })).source).toBe('company')
  })
})

describe('upsert / desativação da chave padrão', () => {
  const base = { companyId: COMPANY, ...IDENTITY, active: true }

  it('upsert sem as obrigatórias é recusado, nomeando as que faltam', async () => {
    const { repository, store } = setup()
    const useCase = new UpsertTemplateUseCase(repository, CATALOG)

    const error = await useCase
      .execute({ ...base, body: '<p>{{corpoMensagem}}</p>' })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(StandardEmailTemplateInvalidError)
    expect((error as StandardEmailTemplateInvalidError).statusCode).toBe(400)
    expect((error as StandardEmailTemplateInvalidError).missing).toContain('rodapePlataforma')
    expect(store.rows).toHaveLength(0)
  })

  it('upsert com HTML inseguro é recusado', async () => {
    const { repository } = setup()
    const useCase = new UpsertTemplateUseCase(repository, CATALOG)

    await expect(
      useCase.execute({ ...base, body: `${STANDARD_EMAIL_BUILTIN_TEMPLATE.html}<script>x()</script>` }),
    ).rejects.toBeInstanceOf(StandardEmailTemplateInvalidError)
  })

  it('upsert válido grava a versão nova', async () => {
    const { repository, store } = setup()
    const useCase = new UpsertTemplateUseCase(repository, CATALOG)

    const saved = await useCase.execute({ ...base, body: USABLE_EDITED })

    expect(saved.version).toBe(1)
    expect(store.rows).toHaveLength(1)
  })

  it('upsert com active:false na chave é recusado (Required), não vira "Remover" por outro caminho', async () => {
    const { repository } = setup()
    const useCase = new UpsertTemplateUseCase(repository, CATALOG)

    await expect(useCase.execute({ ...base, active: false, body: USABLE_EDITED })).rejects.toBeInstanceOf(
      StandardEmailTemplateRequiredError,
    )
  })

  it('desativar a chave é recusado (409) e a linha continua ativa', async () => {
    const existing = row()
    const { repository, store } = setup([existing])

    const error = await new DeactivateTemplateUseCase(repository)
      .execute({ companyId: COMPANY, id: existing.id })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(StandardEmailTemplateRequiredError)
    expect((error as StandardEmailTemplateRequiredError).statusCode).toBe(409)
    expect(store.rows[0]?.active).toBe(true)
  })

  it('outras chaves seguem sem a exigência', async () => {
    const { repository } = setup()
    const useCase = new UpsertTemplateUseCase(repository, CATALOG)

    await expect(useCase.execute({ ...base, key: 'order.ready', body: 'qualquer' })).resolves.toBeDefined()
  })
})
