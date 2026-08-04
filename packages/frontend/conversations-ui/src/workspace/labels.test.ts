import { describe, expect, it } from 'bun:test'

import { DEFAULT_CONVERSATIONS_WORKSPACE_LABELS as labels } from './labels'

describe('DEFAULT_CONVERSATIONS_WORKSPACE_LABELS', () => {
  it('concorda o plural com a contagem', () => {
    expect(labels.bulkSelected(1)).toBe('1 selecionada')
    expect(labels.bulkSelected(3)).toBe('3 selecionadas')
    expect(labels.bulkFinalizeConfirm(1)).toBe('Finalizar 1 conversa?')
    expect(labels.bulkFinalizeConfirm(2)).toBe('Finalizar 2 conversas?')
  })

  it('não mostra faixa quando não há resultado — "1–0 de 0" parecia defeito', () => {
    expect(labels.rangeOf(1, 0, 0)).toBe('0 de 0')
    expect(labels.rangeOf(1, 50, 137)).toBe('1–50 de 137')
  })
})
