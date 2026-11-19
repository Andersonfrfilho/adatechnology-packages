import { describe, expect, it } from 'bun:test'

import {
  computePrefetchDistance,
  computeScrollTopAfterPrepend,
  shouldPrefetchOlderMessages,
} from './useLoadOlderMessagesScroll'

describe('computeScrollTopAfterPrepend', () => {
  it('soma ao scrollTop atual o quanto a mensagem-âncora desceu com a página prependida', () => {
    // Âncora estava a 40px do topo do conteúdo; a página anterior a empurrou para 840px.
    expect(computeScrollTopAfterPrepend(300, 40, 840)).toBe(1100)
  })

  it('usa a posição atual, não a do disparo: o operador pode ter rolado enquanto a página chegava', () => {
    // Disparou em 500px, rolou até 120px durante a busca; a página somou 900px por cima da âncora.
    expect(computeScrollTopAfterPrepend(120, 60, 960)).toBe(1020)
  })

  it('não desloca a rolagem quando nada entrou por cima da âncora', () => {
    expect(computeScrollTopAfterPrepend(300, 40, 40)).toBe(300)
  })
})

describe('prefetch de mensagens anteriores', () => {
  it('começa a buscar a cerca de uma tela do topo', () => {
    expect(computePrefetchDistance(900)).toBe(900)
    expect(shouldPrefetchOlderMessages(850, 900)).toBe(true)
    expect(shouldPrefetchOlderMessages(950, 900)).toBe(false)
  })

  it('nunca usa menos que o piso em telas baixas', () => {
    expect(computePrefetchDistance(300)).toBe(600)
    expect(shouldPrefetchOlderMessages(550, 300)).toBe(true)
  })
})
