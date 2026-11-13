import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ConversationSimulatorPanel, type ConversationSimulatorPanelProps } from './ConversationSimulatorPanel'
import { createMockSSEProvider } from './createMockSSEProvider'
import { createPreviewStore } from './previewStore'

function markupOf(overrides: Partial<ConversationSimulatorPanelProps> = {}): string {
  const store = createPreviewStore({ conversations: [], messages: {} })

  return renderToStaticMarkup(
    <ConversationSimulatorPanel
      conversationId="5511900000042"
      onClose={() => {}}
      client={{ sendText: async () => {}, sendInteractiveReply: async () => {} } as never}
      sse={createMockSSEProvider({ store })}
      loadMessages={async () => []}
      {...overrides}
    />,
  )
}

describe('ConversationSimulatorPanel', () => {
  it('mostra o telefone formatado pelo host, e não o id cru', () => {
    expect(markupOf({ displayNumber: '+55 (11) 90000-0042' })).toContain('+55 (11) 90000-0042')
  })

  it('cai no id da conversa quando o host não formata', () => {
    expect(markupOf()).toContain('5511900000042')
  })

  it('avisa para onde a mensagem vai, para ninguém achar que é conversa de mentira', () => {
    expect(markupOf()).toContain('entrega no webhook real')
  })

  it('dá nome acessível ao botão de fechar, que só tem ícone', () => {
    expect(markupOf()).toContain('aria-label="Fechar simulador"')
  })

  it('aceita rótulos parciais do host sem exigir o conjunto inteiro', () => {
    const markup = markupOf({ labels: { title: 'Testar fluxo' } })

    expect(markup).toContain('Testar fluxo')
    // O que não foi sobrescrito continua no default.
    expect(markup).toContain('aria-label="Fechar simulador"')
  })

  it('renderiza ação extra do host no cabeçalho', () => {
    expect(markupOf({ headerActions: <button type="button">Rodar roteiro</button> })).toContain('Rodar roteiro')
  })

  it('nomeia o próprio aside, para o leitor de tela distinguir do transcript ao lado', () => {
    expect(markupOf()).toContain('aria-label="Simulador do cliente"')
  })
})
