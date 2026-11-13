/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O caso que originou isto: o submenu "Ação" aberto perto do rodapé mostrava metade da lista, com
 * "Enviar catálogo de produtos" cortado pela borda — e sem rolagem, o item era inalcançável.
 */

import { describe, expect, it } from 'bun:test'

import { placeFloatingPanel } from './flowMenuPlacement'

const VIEWPORT = { width: 1200, height: 800 }
const rect = (left: number, top: number, width = 0, height = 0) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
})

describe('menu abaixo do ponto clicado', () => {
  it('fica onde foi pedido quando há espaço', () => {
    const placement = placeFloatingPanel({
      anchor: rect(100, 100),
      panel: { width: 256, height: 300 },
      viewport: VIEWPORT,
      prefer: 'below',
    })

    expect(placement.left).toBeGreaterThanOrEqual(100)
    expect(placement.top).toBe(100)
    expect(placement.maxHeight).toBe(300)
  })

  it('encosta na borda direita em vez de sair dela', () => {
    const placement = placeFloatingPanel({
      anchor: rect(1150, 100),
      panel: { width: 256, height: 300 },
      viewport: VIEWPORT,
      prefer: 'below',
    })

    expect(placement.left + 256).toBeLessThanOrEqual(VIEWPORT.width)
  })

  it('sobe quando não cabe para baixo, em vez de vazar pelo rodapé', () => {
    const placement = placeFloatingPanel({
      anchor: rect(100, 700),
      panel: { width: 256, height: 300 },
      viewport: VIEWPORT,
      prefer: 'below',
    })

    expect(placement.top + placement.maxHeight).toBeLessThanOrEqual(VIEWPORT.height)
    expect(placement.top).toBeLessThan(700)
  })
})

describe('submenu ao lado do item', () => {
  it('abre à direita quando cabe', () => {
    const placement = placeFloatingPanel({
      anchor: rect(300, 200, 256, 36),
      panel: { width: 256, height: 240 },
      viewport: VIEWPORT,
      prefer: 'side',
    })

    expect(placement.left).toBeGreaterThanOrEqual(300 + 256)
  })

  it('vira para a esquerda quando não cabe à direita', () => {
    const placement = placeFloatingPanel({
      anchor: rect(900, 200, 256, 36),
      panel: { width: 256, height: 240 },
      viewport: VIEWPORT,
      prefer: 'side',
    })

    expect(placement.left).toBeLessThan(900)
    expect(placement.left).toBeGreaterThanOrEqual(0)
  })

  it('lista longa perto do rodapé ganha rolagem em vez de ser cortada', () => {
    // O caso da captura: submenu de ações mais alto que o espaço abaixo do item.
    const placement = placeFloatingPanel({
      anchor: rect(300, 620, 256, 36),
      panel: { width: 256, height: 520 },
      viewport: VIEWPORT,
      prefer: 'side',
    })

    expect(placement.top + placement.maxHeight).toBeLessThanOrEqual(VIEWPORT.height)
    expect(placement.maxHeight).toBeLessThanOrEqual(520)
  })

  it('painel mais alto que a tela cabe inteiro na tela, rolando por dentro', () => {
    const placement = placeFloatingPanel({
      anchor: rect(300, 400, 256, 36),
      panel: { width: 256, height: 2000 },
      viewport: VIEWPORT,
      prefer: 'side',
    })

    expect(placement.top).toBeGreaterThanOrEqual(0)
    expect(placement.maxHeight).toBeLessThan(VIEWPORT.height)
    expect(placement.top + placement.maxHeight).toBeLessThanOrEqual(VIEWPORT.height)
  })
})

describe('os menus do editor usam a conta acima', () => {
  /**
   * A função pura pode estar correta e ninguém chamá-la. Estes dois amarram o uso: sem eles a
   * correção some no primeiro refactor e o menu volta a encostar na borda.
   */
  it('o menu do "+" mede antes de posicionar, em vez de usar a âncora crua', async () => {
    const content = await Bun.file(`${import.meta.dir}/FlowsWorkspace.tsx`).text()

    expect(content).toContain('placeFloatingPanel')
    expect(content).not.toContain('left: quickAddFrom.anchor.x + 12')
  })

  it('o submenu não fica mais preso ao item por CSS', async () => {
    const content = await Bun.file(`${import.meta.dir}/FlowPalette.tsx`).text()

    expect(content).toContain('placeFloatingPanel')
    // Verifica o uso em JSX, não a menção: o comentário do arquivo cita a classe antiga para
    // explicar o que mudou, e casar com o texto solto reprovaria a própria explicação.
    expect(content).not.toContain('className="absolute left-full')
    expect(content).toContain('overflowY')
  })
})
