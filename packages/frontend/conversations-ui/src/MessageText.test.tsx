import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { MessageText } from './MessageText'
import { MessageTextCopiedBadge } from './MessageTextCopiedBadge'
import type { MessagePayload } from './types'

const TEXT_MESSAGE: MessagePayload = {
  id: 'msg-1',
  type: 'text',
  direction: 'inbound',
  sender: 'customer',
  timestamp: '2026-08-05T12:00:00.000Z',
  content: 'Olá *mundo*',
}

describe('MessageText', () => {
  it('usa a classe cv-message-text e nenhuma utilitária Tailwind', () => {
    const markup = renderToStaticMarkup(<MessageText message={TEXT_MESSAGE} />)

    expect(markup).toContain('cv-message-text')
    expect(markup).not.toContain('whitespace-pre-wrap')
    expect(markup).not.toContain('select-all')
    expect(markup).not.toContain('text-[')
    expect(markup).not.toContain('[&_')
  })

  it('o badge usa a classe cv-message-text__copied e nenhuma utilitária Tailwind', () => {
    const markup = renderToStaticMarkup(<MessageTextCopiedBadge />)

    expect(markup).toContain('cv-message-text__copied')
    expect(markup).not.toContain('absolute')
    expect(markup).not.toContain('bg-[')
    expect(markup).not.toContain('px-1.5')
    expect(markup).not.toContain('-translate-y-full')
  })

  it('por padrão não copia ao toque: sem onClick, sem role=button e sem user-select', () => {
    const markup = renderToStaticMarkup(<MessageText message={TEXT_MESSAGE} />)

    expect(markup).not.toContain('role="button"')
    expect(markup).not.toContain('tabindex')
  })

  it('com copyOnClick vira um controle acessível por teclado', () => {
    const markup = renderToStaticMarkup(<MessageText message={TEXT_MESSAGE} copyOnClick />)

    expect(markup).toContain('role="button"')
    expect(markup).toContain('tabindex="0"')
  })

  it('o badge usa "Copied" por padrão e aceita outro rótulo', () => {
    expect(renderToStaticMarkup(<MessageTextCopiedBadge />)).toContain('Copied')
    expect(renderToStaticMarkup(<MessageTextCopiedBadge label="Copiado!" />)).toContain('Copiado!')
  })
})
