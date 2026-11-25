/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import {
  InvalidTemplateDefinitionError,
  TemplateIdNotFoundError,
  TemplateNotFoundError,
  assertTemplateDefinitions,
} from '@adatechnology/notification-contracts'
import type { TemplateDefinition } from '@adatechnology/notification-contracts'

import { createDefaultTemplateRenderer } from '../shared/DefaultTemplateRenderer'
import type { TemplateRepository } from '../repositories/TemplateRepository'
import { buildTemplateRow, createInMemoryTemplates } from '../testing/inMemoryRepositories'
import {
  EnsureTemplateDefinitionsUseCase,
  ListTemplateEditorItemsUseCase,
  RenderTemplateTextUseCase,
  RestoreTemplateDefaultUseCase,
} from './TemplateDefinition.use-cases'

const COMPANY = randomUUID()
const DEFINITION: TemplateDefinition = {
  key: 'welcome',
  channel: 'whatsapp',
  locale: 'pt-BR',
  label: 'Boas-vindas',
  description: 'Primeira mensagem da conversa',
  body: 'Olá {{name}}, bem-vindo!',
  variables: [{ name: 'name', description: 'Nome do contato', example: 'Maria', required: true }],
}

function setup(definitions: readonly TemplateDefinition[] = [DEFINITION]) {
  const store = createInMemoryTemplates()
  const repository = store as unknown as TemplateRepository
  return {
    store,
    ensure: new EnsureTemplateDefinitionsUseCase(repository, definitions),
    list: new ListTemplateEditorItemsUseCase(repository, definitions),
    restore: new RestoreTemplateDefaultUseCase(repository, definitions),
    render: new RenderTemplateTextUseCase(repository, definitions, createDefaultTemplateRenderer(), 'pt-BR'),
  }
}

describe('EnsureTemplateDefinitionsUseCase', () => {
  it('grava a v1 e é idempotente', async () => {
    const { ensure, store } = setup()

    expect(await ensure.execute({ companyId: COMPANY })).toEqual(['welcome'])
    expect(await ensure.execute({ companyId: COMPANY })).toEqual([])
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0]?.version).toBe(1)
    expect(store.rows[0]?.body).toBe(DEFINITION.body)
  })

  it('não sobrescreve texto editado nem desativado', async () => {
    const { ensure, store } = setup()
    store.rows.push(
      buildTemplateRow({ companyId: COMPANY, key: 'welcome', channel: 'whatsapp', body: 'editado', active: false }),
    )

    expect(await ensure.execute({ companyId: COMPANY })).toEqual([])
    expect(store.rows).toHaveLength(1)
  })
})

describe('ListTemplateEditorItemsUseCase', () => {
  it('sinaliza personalização e traz metadados', async () => {
    const { ensure, list, store } = setup()
    await ensure.execute({ companyId: COMPANY })

    const [pristine] = await list.execute({ companyId: COMPANY })
    expect(pristine?.label).toBe('Boas-vindas')
    expect(pristine?.defaultBody).toBe(DEFINITION.body)
    expect(pristine?.isCustomized).toBe(false)
    expect(pristine?.variables[0]?.description).toBe('Nome do contato')

    await store.upsert({
      companyId: COMPANY,
      key: 'welcome',
      channel: 'whatsapp',
      locale: 'pt-BR',
      body: 'Oi {{name}}',
    })
    const [edited] = await list.execute({ companyId: COMPANY })
    expect(edited?.isCustomized).toBe(true)
    expect(edited?.current?.version).toBe(2)
  })

  it('definição sem linha no banco vem sem current', async () => {
    const [item] = await setup().list.execute({ companyId: COMPANY })
    expect(item?.current).toBeUndefined()
    expect(item?.isCustomized).toBe(false)
  })
})

describe('RestoreTemplateDefaultUseCase', () => {
  it('cria versão nova com o texto padrão e preserva o histórico', async () => {
    const { ensure, restore, store } = setup()
    await ensure.execute({ companyId: COMPANY })
    const edited = await store.upsert({
      companyId: COMPANY,
      key: 'welcome',
      channel: 'whatsapp',
      locale: 'pt-BR',
      body: 'x',
    })

    const restored = await restore.execute({ companyId: COMPANY, id: edited.id })

    expect(restored.version).toBe(3)
    expect(restored.body).toBe(DEFINITION.body)
    expect(store.rows).toHaveLength(3)
  })

  it('id de outra empresa ou sem definição é "não encontrado"', async () => {
    const { restore, store } = setup()
    const foreign = buildTemplateRow({ companyId: randomUUID(), key: 'welcome', channel: 'whatsapp' })
    const undeclared = buildTemplateRow({ companyId: COMPANY, key: 'other', channel: 'whatsapp' })
    store.rows.push(foreign, undeclared)

    await expect(restore.execute({ companyId: COMPANY, id: foreign.id })).rejects.toBeInstanceOf(
      TemplateIdNotFoundError,
    )
    await expect(restore.execute({ companyId: COMPANY, id: undeclared.id })).rejects.toBeInstanceOf(
      TemplateIdNotFoundError,
    )
  })
})

describe('RenderTemplateTextUseCase', () => {
  it('sem versão ativa usa o padrão; com versão usa a da empresa', async () => {
    const { render, store } = setup()
    const fallback = await render.execute({
      companyId: COMPANY,
      key: 'welcome',
      channel: 'whatsapp',
      payload: { name: 'Ana' },
    })
    expect(fallback).toMatchObject({ body: 'Olá Ana, bem-vindo!', source: 'default', version: 0 })

    await store.upsert({
      companyId: COMPANY,
      key: 'welcome',
      channel: 'whatsapp',
      locale: 'pt-BR',
      body: 'Oi {{name}}',
    })
    const custom = await render.execute({
      companyId: COMPANY,
      key: 'welcome',
      channel: 'whatsapp',
      payload: { name: 'Ana' },
    })
    expect(custom).toMatchObject({ body: 'Oi Ana', source: 'company', version: 1 })
  })

  it('chave sem definição nem versão lança TemplateNotFoundError', async () => {
    await expect(
      setup().render.execute({ companyId: COMPANY, key: 'nope', channel: 'whatsapp' }),
    ).rejects.toBeInstanceOf(TemplateNotFoundError)
  })
})

describe('assertTemplateDefinitions', () => {
  it('recusa variável não declarada no texto padrão, duplicidade e label vazio', () => {
    expect(() => assertTemplateDefinitions([{ ...DEFINITION, body: 'Olá {{typo}}' }])).toThrow(
      InvalidTemplateDefinitionError,
    )
    expect(() => assertTemplateDefinitions([DEFINITION, DEFINITION])).toThrow(InvalidTemplateDefinitionError)
    expect(() => assertTemplateDefinitions([{ ...DEFINITION, label: ' ' }])).toThrow(InvalidTemplateDefinitionError)
    expect(() => assertTemplateDefinitions([DEFINITION])).not.toThrow()
  })
})
