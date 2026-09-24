import { describe, expect, it } from 'bun:test'

import { computeScrollTopAfterPrepend } from './useLoadOlderMessagesScroll'

describe('computeScrollTopAfterPrepend', () => {
  it('mantém o mesmo ponto visual somando ao scrollTop a altura que o conteúdo antigo acrescentou', () => {
    // Container tinha 2000px de conteúdo, operador em 300px do topo; a página anterior somou 800px.
    const before = { scrollHeight: 2000, scrollTop: 300 }
    expect(computeScrollTopAfterPrepend(before, 2800)).toBe(1100)
  })

  it('não desloca a rolagem quando a altura não muda', () => {
    const before = { scrollHeight: 2000, scrollTop: 300 }
    expect(computeScrollTopAfterPrepend(before, 2000)).toBe(300)
  })

  it('funciona a partir do topo absoluto (scrollTop=0)', () => {
    const before = { scrollHeight: 2000, scrollTop: 0 }
    expect(computeScrollTopAfterPrepend(before, 2500)).toBe(500)
  })
})
