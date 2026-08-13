import { describe, expect, it } from 'bun:test'

import { DEFAULT_PRODUCTS_WORKSPACE_LABELS as labels } from './labels'

describe('DEFAULT_PRODUCTS_WORKSPACE_LABELS', () => {
  it('não mostra "página 1 de 0" quando a busca não acha nada', () => {
    expect(labels.rangeOf(1, 0, 0)).toBe('Nenhum produto')
  })

  it('concorda o plural com a contagem', () => {
    expect(labels.rangeOf(1, 1, 1)).toBe('Página 1 de 1 · 1 produto')
    expect(labels.rangeOf(2, 4, 73)).toBe('Página 2 de 4 · 73 produtos')
  })

  it('nomeia a exclusão pelo item, para não apagar o produto errado', () => {
    expect(labels.removeConfirm('Cafeteira')).toContain('Cafeteira')
  })
})
