/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, it } from 'bun:test'

import {
  advanceExpenseConversation,
  isDirectExpenseIntent,
  parseExpenseAmount,
  parseExpenseDueDate,
  parseSettlementReply,
  startExpenseConversation,
  type ExpenseConversationResult,
} from './index'

const categories = [
  { id: 'c-aluguel', name: 'Aluguel' },
  { id: 'c-energia', name: 'Energia' },
]

function run(inputs: readonly string[]): ExpenseConversationResult {
  let result = startExpenseConversation()
  for (const input of inputs) {
    result = advanceExpenseConversation({ categories, input, state: result.state, today: '2026-11-20' })
  }
  return result
}

describe('lançar conta pela conversa', () => {
  it('fixa: tipo, nome, categoria, valor, frequência, dia e confirmar', () => {
    const result = run(['fixed', 'Aluguel do galpão', '1', 'R$ 3.500,00', 'monthly', 'dia 5', 'confirm'])
    expect(result.state.step).toBe('done')
    expect(result.submit).toEqual({
      categoryId: 'c-aluguel',
      dueDay: 5,
      expectedAmount: '3500.00',
      kind: 'fixed',
      name: 'Aluguel do galpão',
      recurrence: 'monthly',
    })
  })

  it('variável por texto livre, com data dd/mm', () => {
    const result = run(['variável', 'Conserto da geladeira', 'energia', '890,9', '25/11', 'sim'])
    expect(result.submit).toEqual({
      categoryId: 'c-energia',
      dueDate: '2026-11-25',
      expectedAmount: '890.90',
      kind: 'variable',
      name: 'Conserto da geladeira',
    })
  })

  it('resposta inválida repete a pergunta sem perder o rascunho', () => {
    const result = run(['fixed', 'Internet', 'Energia', 'muito'])
    expect(result.state.step).toBe('amount')
    expect(result.state.draft.name).toBe('Internet')
    expect(result.submit).toBeUndefined()
  })

  it('cancelar em qualquer passo encerra sem gravar', () => {
    const result = run(['fixed', 'Internet', 'cancelar'])
    expect(result.state.step).toBe('cancelled')
    expect(result.submit).toBeUndefined()
  })

  it('o resumo do confirmar mostra o valor em reais', () => {
    const result = run(['variable', 'Gás', '2', '120', 'amanhã'])
    expect(result.state.step).toBe('confirm')
    expect(result.prompt.text).toContain('R$ 120,00')
    expect(result.prompt.text).toContain('21/11/2026')
  })
})

describe('entrada digitada', () => {
  it('valores e datas', () => {
    expect(parseExpenseAmount('R$ 1.500,50')).toBe('1500.50')
    expect(parseExpenseAmount('0')).toBeUndefined()
    expect(parseExpenseDueDate('10/01', '2026-11-20')).toBe('2027-01-10')
    expect(parseExpenseDueDate('31/02/2026', '2026-11-20')).toBeUndefined()
  })

  it('intenção e baixa por resposta', () => {
    expect(isDirectExpenseIntent('quero lançar uma conta')).toBe(true)
    expect(isDirectExpenseIntent('cadê meu pedido')).toBe(false)
    expect(parseSettlementReply('já paguei R$ 150,00')).toEqual({ amount: '150.00' })
    expect(parseSettlementReply('paguei')).toEqual({})
    expect(parseSettlementReply('ainda não paguei')).toBeNull()
  })
})
