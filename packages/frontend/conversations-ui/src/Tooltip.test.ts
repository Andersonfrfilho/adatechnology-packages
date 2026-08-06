import { describe, expect, test } from 'bun:test'

import { tooltipPositionOf } from './Tooltip'

const VIEWPORT_WIDTH = 1024

describe('tooltipPositionOf', () => {
  test('desenha acima do alvo e centralizado nele', () => {
    const position = tooltipPositionOf({
      targetRect: { top: 300, bottom: 336, left: 400, width: 36 },
      viewportWidth: VIEWPORT_WIDTH,
    })

    expect(position.placement).toBe('top')
    expect(position.left).toBe(418)
    expect(position.top).toBe(292)
  })

  test('desce quando o alvo está colado no topo da janela', () => {
    const position = tooltipPositionOf({
      targetRect: { top: 12, bottom: 48, left: 400, width: 36 },
      viewportWidth: VIEWPORT_WIDTH,
    })

    expect(position.placement).toBe('bottom')
    expect(position.top).toBe(56)
  })

  test('afasta da borda o balão de um alvo no canto', () => {
    const esquerda = tooltipPositionOf({
      targetRect: { top: 300, bottom: 336, left: 0, width: 36 },
      viewportWidth: VIEWPORT_WIDTH,
    })
    const direita = tooltipPositionOf({
      targetRect: { top: 300, bottom: 336, left: VIEWPORT_WIDTH - 36, width: 36 },
      viewportWidth: VIEWPORT_WIDTH,
    })

    expect(esquerda.left).toBe(72)
    expect(direita.left).toBe(VIEWPORT_WIDTH - 72)
  })
})
