import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { InteractiveMessage } from './InteractiveMessage'
import { MessageText } from './MessageText'

const BLOCK_MESSAGE = 'Opções:\n- *um*\n1. dois\n> três'

/** `<ul>`/`<div>`/`<blockquote>` dentro de `<span>` ou `<p>` é HTML inválido — o navegador reordena. */
function hasBlockInsideInline(markup: string): boolean {
  return /<(span|p)\b[^>]*>(?:(?!<\/\1>).)*<(ul|ol|div|blockquote)\b/s.test(markup)
}

describe('blocos da formatação do WhatsApp nos invólucros de mensagem', () => {
  it('MessageText não põe lista nem citação dentro de elemento inline', () => {
    const markup = renderToStaticMarkup(
      <MessageText
        message={{
          id: 'm1',
          type: 'text',
          direction: 'inbound',
          sender: 'customer',
          timestamp: '2026-09-15T12:00:00.000Z',
          content: BLOCK_MESSAGE,
        }}
      />,
    )
    expect(markup).toContain('<ul')
    expect(markup).toContain('<blockquote')
    expect(hasBlockInsideInline(markup)).toBe(false)
  })

  it('InteractiveMessage também não, no cabeçalho, corpo e rodapé', () => {
    const markup = renderToStaticMarkup(
      <InteractiveMessage
        payload={{
          type: 'button',
          header: { text: BLOCK_MESSAGE },
          body: { text: BLOCK_MESSAGE },
          footer: { text: BLOCK_MESSAGE },
        }}
      />,
    )
    expect(markup).toContain('<ol')
    expect(hasBlockInsideInline(markup)).toBe(false)
  })
})
