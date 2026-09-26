/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * T211 (RF9): respostas rápidas por público, sem regra própria — CRUD simples na porta.
 * Leitura por público, orden por position (só ativas para o compositor; todas para gestão),
 * criar, editar texto/posição, desativar/reativar com isolamento de tenant.
 */
import { describe, expect, it } from 'bun:test'

import { createFixedClock, createInMemoryQuickReplies } from '../testing/inMemoryRepositories'
import {
  CreateQuickReplyUseCase,
  ListQuickRepliesForComposerUseCase,
  ListAllQuickRepliesUseCase,
  UpdateQuickReplyUseCase,
  QuickReplyInvalidError,
  QuickReplyNotFoundError,
} from './QuickReply.use-cases'

const COMPANY_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_COMPANY_ID = '99999999-9999-9999-9999-999999999999'
const NOW = new Date('2026-09-26T12:00:00.000Z')

describe('CreateQuickReplyUseCase (RF9)', () => {
  it('cria uma resposta rápida com posição automática', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const useCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })

    const result = await useCase.execute({
      companyId: COMPANY_ID,
      audience: 'customer',
      bodyText: 'Obrigado pelo contato!',
    })

    expect(result.companyId).toBe(COMPANY_ID)
    expect(result.audience).toBe('customer')
    expect(result.bodyText).toBe('Obrigado pelo contato!')
    expect(result.position).toBe(0)
    expect(result.active).toBe(true)
  })

  it('incrementa position para segunda resposta do mesmo público', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const useCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })

    await useCase.execute({
      companyId: COMPANY_ID,
      audience: 'customer',
      bodyText: 'Resposta 1',
    })
    const second = await useCase.execute({
      companyId: COMPANY_ID,
      audience: 'customer',
      bodyText: 'Resposta 2',
    })

    expect(second.position).toBe(1)
  })

  it('normaliza whitespace do texto (trim)', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const useCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })

    const result = await useCase.execute({
      companyId: COMPANY_ID,
      audience: 'customer',
      bodyText: '  Texto com espaços  ',
    })

    expect(result.bodyText).toBe('Texto com espaços')
  })

  it('rejeita texto em branco', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const useCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })

    let threw = false
    try {
      await useCase.execute({
        companyId: COMPANY_ID,
        audience: 'customer',
        bodyText: '   ',
      })
    } catch (e) {
      threw = true
      expect(e).toBeInstanceOf(QuickReplyInvalidError)
    }
    expect(threw).toBe(true)
  })

  it('rejeita texto acima de 500 caracteres', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const useCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })

    let threw = false
    try {
      await useCase.execute({
        companyId: COMPANY_ID,
        audience: 'customer',
        bodyText: 'a'.repeat(501),
      })
    } catch (e) {
      threw = true
      expect(e).toBeInstanceOf(QuickReplyInvalidError)
    }
    expect(threw).toBe(true)
  })

  it('aceita texto com exatamente 500 caracteres', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const useCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })

    const result = await useCase.execute({
      companyId: COMPANY_ID,
      audience: 'customer',
      bodyText: 'a'.repeat(500),
    })

    expect(result.bodyText).toHaveLength(500)
  })
})

describe('ListAllQuickRepliesUseCase (RF9)', () => {
  it('lista todas as respostas ordenadas por posição', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const createUseCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })
    const listUseCase = new ListAllQuickRepliesUseCase({ quickReplies })

    await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'R2' })
    await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'R3' })
    await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'R1' })

    const results = await listUseCase.execute({ companyId: COMPANY_ID })

    expect(results).toHaveLength(3)
    expect(results[0].bodyText).toBe('R2')
    expect(results[1].bodyText).toBe('R3')
    expect(results[2].bodyText).toBe('R1')
  })

  it('inclui inativas na listagem da gestão', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const createUseCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })
    const updateUseCase = new UpdateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })
    const listUseCase = new ListAllQuickRepliesUseCase({ quickReplies })

    await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'Ativa' })
    const r2 = await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'Desativada' })

    await updateUseCase.execute({ companyId: COMPANY_ID, id: r2.id, active: false })

    const results = await listUseCase.execute({ companyId: COMPANY_ID })

    expect(results).toHaveLength(2)
    expect(results.some((r) => !r.active)).toBe(true)
  })

  it('retorna vazio para empresa sem respostas', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const listUseCase = new ListAllQuickRepliesUseCase({ quickReplies })

    const results = await listUseCase.execute({ companyId: COMPANY_ID })

    expect(results).toHaveLength(0)
  })

  it('isola por companyId', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const createUseCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })
    const listUseCase = new ListAllQuickRepliesUseCase({ quickReplies })

    await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'R1' })
    await createUseCase.execute({ companyId: OTHER_COMPANY_ID, audience: 'customer', bodyText: 'R2' })

    const results = await listUseCase.execute({ companyId: COMPANY_ID })

    expect(results).toHaveLength(1)
    expect(results[0].bodyText).toBe('R1')
  })
})

describe('ListQuickRepliesForComposerUseCase (RF9)', () => {
  it('lista apenas ativas ordenadas por posição', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const createUseCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })
    const updateUseCase = new UpdateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })
    const listUseCase = new ListQuickRepliesForComposerUseCase({ quickReplies })

    await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'Ativa 1' })
    const r2 = await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'Será desativada' })
    await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'Ativa 2' })

    await updateUseCase.execute({ companyId: COMPANY_ID, id: r2.id, active: false })

    const results = await listUseCase.execute({ companyId: COMPANY_ID, audience: 'customer' })

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.active)).toBe(true)
    expect(results[0].bodyText).toBe('Ativa 1')
    expect(results[1].bodyText).toBe('Ativa 2')
  })

  it('filtra por público', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const createUseCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })
    const listUseCase = new ListQuickRepliesForComposerUseCase({ quickReplies })

    await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'Para customer' })
    await createUseCase.execute({ companyId: COMPANY_ID, audience: 'support', bodyText: 'Para support' })

    const customerResults = await listUseCase.execute({ companyId: COMPANY_ID, audience: 'customer' })
    const supportResults = await listUseCase.execute({ companyId: COMPANY_ID, audience: 'support' })

    expect(customerResults).toHaveLength(1)
    expect(customerResults[0].audience).toBe('customer')
    expect(supportResults).toHaveLength(1)
    expect(supportResults[0].audience).toBe('support')
  })

  it('retorna vazio para público sem respostas ativas', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const createUseCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })
    const updateUseCase = new UpdateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })
    const listUseCase = new ListQuickRepliesForComposerUseCase({ quickReplies })

    const created = await createUseCase.execute({
      companyId: COMPANY_ID,
      audience: 'customer',
      bodyText: 'Será desativada',
    })
    await updateUseCase.execute({ companyId: COMPANY_ID, id: created.id, active: false })

    const results = await listUseCase.execute({ companyId: COMPANY_ID, audience: 'customer' })

    expect(results).toHaveLength(0)
  })

  it('isola por companyId', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const createUseCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })
    const listUseCase = new ListQuickRepliesForComposerUseCase({ quickReplies })

    await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'R1' })
    await createUseCase.execute({ companyId: OTHER_COMPANY_ID, audience: 'customer', bodyText: 'R2' })

    const results = await listUseCase.execute({ companyId: COMPANY_ID, audience: 'customer' })

    expect(results).toHaveLength(1)
    expect(results[0].bodyText).toBe('R1')
  })
})

describe('UpdateQuickReplyUseCase (RF9)', () => {
  it('edita texto de resposta rápida', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const createUseCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })
    const updateUseCase = new UpdateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })

    const r1 = await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'Texto original' })

    const updated = await updateUseCase.execute({
      companyId: COMPANY_ID,
      id: r1.id,
      bodyText: 'Texto editado',
    })

    expect(updated.bodyText).toBe('Texto editado')
  })

  it('edita posição de resposta rápida', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const createUseCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })
    const updateUseCase = new UpdateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })

    const r1 = await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'R1' })

    const updated = await updateUseCase.execute({
      companyId: COMPANY_ID,
      id: r1.id,
      position: 5,
    })

    expect(updated.position).toBe(5)
  })

  it('desativa resposta rápida', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const createUseCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })
    const updateUseCase = new UpdateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })

    const r1 = await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'R1' })

    const updated = await updateUseCase.execute({
      companyId: COMPANY_ID,
      id: r1.id,
      active: false,
    })

    expect(updated.active).toBe(false)
  })

  it('reativa resposta rápida', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const createUseCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })
    const updateUseCase = new UpdateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })

    const r1 = await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'R1' })
    await updateUseCase.execute({ companyId: COMPANY_ID, id: r1.id, active: false })

    const updated = await updateUseCase.execute({
      companyId: COMPANY_ID,
      id: r1.id,
      active: true,
    })

    expect(updated.active).toBe(true)
  })

  it('rejeita texto em branco na edição', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const createUseCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })
    const updateUseCase = new UpdateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })

    const r1 = await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'R1' })

    let threw = false
    try {
      await updateUseCase.execute({
        companyId: COMPANY_ID,
        id: r1.id,
        bodyText: '   ',
      })
    } catch (e) {
      threw = true
      expect(e).toBeInstanceOf(QuickReplyInvalidError)
    }
    expect(threw).toBe(true)
  })

  it('rejeita texto acima de 500 caracteres na edição', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const createUseCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })
    const updateUseCase = new UpdateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })

    const r1 = await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'R1' })

    let threw = false
    try {
      await updateUseCase.execute({
        companyId: COMPANY_ID,
        id: r1.id,
        bodyText: 'a'.repeat(501),
      })
    } catch (e) {
      threw = true
      expect(e).toBeInstanceOf(QuickReplyInvalidError)
    }
    expect(threw).toBe(true)
  })

  it('lança erro quando resposta não existe', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const updateUseCase = new UpdateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })

    let threw = false
    try {
      await updateUseCase.execute({
        companyId: COMPANY_ID,
        id: '00000000-0000-0000-0000-000000000000',
        active: false,
      })
    } catch (e) {
      threw = true
      expect(e).toBeInstanceOf(QuickReplyNotFoundError)
    }
    expect(threw).toBe(true)
  })

  it('isola por companyId', async () => {
    const quickReplies = createInMemoryQuickReplies()
    const createUseCase = new CreateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })
    const updateUseCase = new UpdateQuickReplyUseCase({ quickReplies, clock: createFixedClock(NOW) })

    const r1 = await createUseCase.execute({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'R1' })

    let threw = false
    try {
      await updateUseCase.execute({
        companyId: OTHER_COMPANY_ID,
        id: r1.id,
        active: false,
      })
    } catch (e) {
      threw = true
      expect(e).toBeInstanceOf(QuickReplyNotFoundError)
    }
    expect(threw).toBe(true)
  })
})
