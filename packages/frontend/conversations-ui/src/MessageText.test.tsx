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
  it('com appearance="stylesheet" usa a classe cv-message-text e nenhuma utilitária Tailwind', () => {
    const markup = renderToStaticMarkup(<MessageText message={TEXT_MESSAGE} appearance="stylesheet" />)

    expect(markup).toContain('cv-message-text')
    expect(markup).not.toContain('whitespace-pre-wrap')
    expect(markup).not.toContain('select-all')
    expect(markup).not.toContain('text-[')
    expect(markup).not.toContain('[&_')
  })

  it('o badge em stylesheet usa a classe cv-message-text__copied e nenhuma utilitária Tailwind', () => {
    const markup = renderToStaticMarkup(<MessageTextCopiedBadge appearance="stylesheet" />)

    expect(markup).toContain('cv-message-text__copied')
    expect(markup).not.toContain('absolute')
    expect(markup).not.toContain('bg-[')
    expect(markup).not.toContain('px-1.5')
    expect(markup).not.toContain('-translate-y-full')
  })

  it('por padrão é o div da 0.4.2: classes Tailwind, sem role nem tabindex', () => {
    const markup = renderToStaticMarkup(<MessageText message={TEXT_MESSAGE} />)

    expect(markup).toContain('select-all')
    expect(markup).toContain('whitespace-pre-wrap')
    expect(markup).not.toContain('role=')
    expect(markup).not.toContain('tabindex')
    expect(markup).not.toContain('cv-message-text')
  })

  it('com accessibleCopy liga role=button e tabindex', () => {
    const markup = renderToStaticMarkup(<MessageText message={TEXT_MESSAGE} accessibleCopy />)

    expect(markup).toContain('role="button"')
    expect(markup).toContain('tabindex="0"')
  })

  it('em stylesheet a classe copiável (user-select) só aparece quando copia', () => {
    const markup = renderToStaticMarkup(<MessageText message={TEXT_MESSAGE} appearance="stylesheet" />)

    expect(markup).toContain('cv-message-text--copyable')
  })

  it('com copyOnClick={false} em stylesheet não copia: sem role, sem tabindex e sem classe copiável', () => {
    const markup = renderToStaticMarkup(
      <MessageText message={TEXT_MESSAGE} copyOnClick={false} accessibleCopy appearance="stylesheet" />,
    )

    expect(markup).not.toContain('role="button"')
    expect(markup).not.toContain('tabindex')
    expect(markup).not.toContain('cv-message-text--copyable')
    expect(markup).toContain('class="cv-message-text"')
  })

  it('o badge usa "Copiado!" por padrão e aceita outro rótulo', () => {
    expect(renderToStaticMarkup(<MessageTextCopiedBadge />)).toContain('Copiado!')
    expect(renderToStaticMarkup(<MessageTextCopiedBadge label="Copied" />)).toContain('Copied')
  })
})
