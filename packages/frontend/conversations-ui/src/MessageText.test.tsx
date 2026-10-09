import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { MessageText } from './MessageText'
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
})
