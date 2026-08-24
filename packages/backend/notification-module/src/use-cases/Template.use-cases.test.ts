/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O painel escreve nestes dois use-cases. Os dois comportamentos travados aqui são os que, se
 * afrouxarem, produzem falha silenciosa em produção: template com variável que nunca é preenchida,
 * e "remoção" que ressuscita a versão anterior.
 */

import { describe, expect, it } from 'bun:test'
import { UnknownTemplateVariablesError } from '@adatechnology/notification-contracts'
import type { TemplateVariableCatalog } from '@adatechnology/notification-contracts'

import { DeactivateTemplateUseCase, UpsertTemplateUseCase } from './Template.use-cases'
import { buildTemplateRow, createInMemoryTemplates } from '../testing/inMemoryRepositories'
import type { TemplateRepository } from '../repositories/TemplateRepository'

const COMPANY_ID = '11111111-1111-4111-8111-111111111111'
const CATALOG: TemplateVariableCatalog = {
  'order.ready': [{ name: 'orderNumber', example: 'QC-1042', required: true }],
}

const baseInput = {
  companyId: COMPANY_ID,
  key: 'order.ready',
  channel: 'email',
  locale: 'pt-BR',
  active: true,
}

describe('UpsertTemplateUseCase', () => {
  it('recusa a variável que o catálogo não declara', async () => {
    const templates = createInMemoryTemplates()
    const useCase = new UpsertTemplateUseCase(templates as unknown as TemplateRepository, CATALOG)

    await expect(useCase.execute({ ...baseInput, body: 'Pedido {{numeroPedido}}' })).rejects.toBeInstanceOf(
      UnknownTemplateVariablesError,
    )
  })

  it('nomeia todas as desconhecidas de uma vez, para a correção não virar tentativa e erro', async () => {
    const templates = createInMemoryTemplates()
    const useCase = new UpsertTemplateUseCase(templates as unknown as TemplateRepository, CATALOG)

    const error = await useCase.execute({ ...baseInput, body: '{{a}} {{b}}' }).catch((caught: unknown) => caught)

    expect((error as UnknownTemplateVariablesError).fields).toEqual(['a', 'b'])
  })

  it('lê o assunto junto com o corpo', async () => {
    const templates = createInMemoryTemplates()
    const useCase = new UpsertTemplateUseCase(templates as unknown as TemplateRepository, CATALOG)

    await expect(
      useCase.execute({ ...baseInput, subject: 'Pedido {{errado}}', body: '{{orderNumber}}' }),
    ).rejects.toBeInstanceOf(UnknownTemplateVariablesError)
  })

  it('sem catálogo declarado para a chave, qualquer variável passa', async () => {
    const templates = createInMemoryTemplates()
    const useCase = new UpsertTemplateUseCase(templates as unknown as TemplateRepository, CATALOG)

    const template = await useCase.execute({ ...baseInput, key: 'outra.chave', body: '{{qualquerCoisa}}' })

    expect(template.key).toBe('outra.chave')
  })

  it('sem catálogo nenhum injetado, o comportamento antigo continua', async () => {
    const templates = createInMemoryTemplates()
    const useCase = new UpsertTemplateUseCase(templates as unknown as TemplateRepository)

    await expect(useCase.execute({ ...baseInput, body: '{{seja_o_que_for}}' })).resolves.toBeDefined()
  })

  it('a obrigatória ausente não bloqueia — um push curto pode legitimamente omitir', async () => {
    const templates = createInMemoryTemplates()
    const useCase = new UpsertTemplateUseCase(templates as unknown as TemplateRepository, CATALOG)

    await expect(useCase.execute({ ...baseInput, body: 'Seu pedido está pronto' })).resolves.toBeDefined()
  })
})

describe('DeactivateTemplateUseCase', () => {
  it('derruba TODAS as versões ativas da identidade, para a anterior não voltar ao ar', async () => {
    const rows = [
      buildTemplateRow({ companyId: COMPANY_ID, key: 'order.ready', channel: 'email', version: 1 }),
      buildTemplateRow({ companyId: COMPANY_ID, key: 'order.ready', channel: 'email', version: 2 }),
    ]
    const templates = createInMemoryTemplates(rows)
    const useCase = new DeactivateTemplateUseCase(templates as unknown as TemplateRepository)

    await useCase.execute({ companyId: COMPANY_ID, id: rows[1]!.id })

    expect(templates.rows.every((row) => !row.active)).toBe(true)
  })

  it('não toca em template de outra chave', async () => {
    const alvo = buildTemplateRow({ companyId: COMPANY_ID, key: 'order.ready', channel: 'email' })
    const vizinho = buildTemplateRow({ companyId: COMPANY_ID, key: 'order.late', channel: 'email' })
    const templates = createInMemoryTemplates([alvo, vizinho])
    const useCase = new DeactivateTemplateUseCase(templates as unknown as TemplateRepository)

    await useCase.execute({ companyId: COMPANY_ID, id: alvo.id })

    expect(templates.rows.find((row) => row.key === 'order.late')?.active).toBe(true)
  })

  it('template de outra empresa não é encontrado — 404, nunca desativação cruzada', async () => {
    const outraEmpresa = buildTemplateRow({
      companyId: '22222222-2222-4222-8222-222222222222',
      key: 'order.ready',
      channel: 'email',
    })
    const templates = createInMemoryTemplates([outraEmpresa])
    const useCase = new DeactivateTemplateUseCase(templates as unknown as TemplateRepository)

    await expect(useCase.execute({ companyId: COMPANY_ID, id: outraEmpresa.id })).rejects.toThrow()
    expect(templates.rows[0]?.active).toBe(true)
  })

  it('é idempotente: desativar de novo não estoura', async () => {
    const row = buildTemplateRow({ companyId: COMPANY_ID, key: 'order.ready', channel: 'email', active: false })
    const templates = createInMemoryTemplates([row])
    const useCase = new DeactivateTemplateUseCase(templates as unknown as TemplateRepository)

    await expect(useCase.execute({ companyId: COMPANY_ID, id: row.id })).resolves.toBeUndefined()
  })
})
