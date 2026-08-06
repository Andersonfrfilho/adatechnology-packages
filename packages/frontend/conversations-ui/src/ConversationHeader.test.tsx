import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ConversationHeader } from './ConversationHeader'
import type { ConversationSummary } from './providers/types'

const noop = () => {}

const CONVERSATION: ConversationSummary = {
  id: 'conv-1',
  clientName: 'Anderson Silva',
  whatsappNumber: '5511988887777',
  channel: 'whatsapp',
  mode: 'human',
  assignedUserId: null,
  waitingHuman: false,
  unread: 0,
  currentState: 'idle',
  lastAt: '2026-01-01T12:00:00.000Z',
  lastInboundAt: null,
}

describe('ConversationHeader sem medida da faixa', () => {
  // Sem `ResizeObserver` (SSR e este teste de markup) o cabeçalho nasce completo. O recolhimento é
  // medido no próprio elemento, e é verificado no navegador.
  it('mostra utilitários e ações na faixa, sem duplicar no menu', () => {
    const markup = renderToStaticMarkup(
      <ConversationHeader
        conversation={CONVERSATION}
        onDownload={noop}
        onOpenDocuments={noop}
        onReturnToBot={noop}
        onFinish={noop}
      />,
    )

    expect(markup).toContain('aria-label="Baixar conversa"')
    expect(markup).toContain('aria-label="Finalizar"')
    expect(markup).not.toContain('aria-label="Mais ações"')
  })

  it('escreve o canal e o modo por extenso quando há espaço', () => {
    const markup = renderToStaticMarkup(<ConversationHeader conversation={CONVERSATION} />)

    expect(markup).toContain('atendimento humano')
  })

  // Emoji desenha diferente em cada sistema e não herda a cor do controle: os ícones do cabeçalho
  // são SVG da biblioteca, como no resto do produto.
  it('desenha os ícones como SVG, sem emoji no meio dos rótulos', () => {
    const markup = renderToStaticMarkup(
      <ConversationHeader
        conversation={CONVERSATION}
        onBack={noop}
        onDownload={noop}
        onOpenDocuments={noop}
        onReturnToBot={noop}
        onFinish={noop}
      />,
    )

    expect(markup).toContain('lucide-download')
    expect(markup).not.toContain('✕')
    expect(markup).not.toContain('⬇️')
  })
})
