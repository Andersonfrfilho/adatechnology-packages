import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { MessageBubble } from './MessageBubble'
import { MessageText } from './MessageText'
import { MessageTextCopiedBadge } from './MessageTextCopiedBadge'
import { StatusTicks } from './StatusTicks'
import type { MessagePayload } from './types'

// Literal markup rendered by @adatechnology/conversations-ui 0.4.2 (b9f1ef6): the default appearance of
// these shared components must never drift, because hosts upgrade without touching their markup.
const LEGACY_TEXT_MARKUP =
  '<div class="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words select-all [&amp;_strong]:font-bold [&amp;_em]:italic [&amp;_del]:line-through"><div><strong>oi</strong></div></div>'

const LEGACY_TEMPLATE_MARKUP = '<p class="text-sm italic text-[#667781] dark:text-[#8696a0]">Olá modelo</p>'

const LEGACY_TICKS_SENT =
  '<span class="cursor-help leading-none flex items-center text-black/40 dark:text-white/40"><svg viewBox="0 0 20 12" width="15" height="9" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 6.5L5 10.5L14.5 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>'

const LEGACY_TICKS_DELIVERED =
  '<span class="cursor-help leading-none flex items-center text-black/40 dark:text-white/40"><svg viewBox="0 0 20 12" width="15" height="9" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 6.5L4.5 10L11 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path><path d="M6 6.5L9.5 10L19 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>'

const LEGACY_TICKS_READ =
  '<span class="cursor-help leading-none flex items-center text-sky-500"><svg viewBox="0 0 20 12" width="15" height="9" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 6.5L4.5 10L11 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path><path d="M6 6.5L9.5 10L19 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>'

const LEGACY_TICKS_FAILED =
  '<span class="cursor-help leading-none flex items-center text-red-500"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-triangle-alert lucide-alert-triangle" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg></span>'

const LEGACY_TICKS_READ_WITH_TITLE =
  '<span class="cursor-help leading-none flex items-center text-sky-500" data-cv-tooltip="x"><svg viewBox="0 0 20 12" width="15" height="9" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 6.5L4.5 10L11 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path><path d="M6 6.5L9.5 10L19 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>'

const LEGACY_COPIED_BADGE_MARKUP =
  '<span class="absolute top-0 right-0 -translate-y-full bg-[#3b4a54] text-white text-[11px] px-1.5 py-0.5 rounded shadow-lg">Copiado!</span>'

const LEGACY_UNKNOWN_STATUS_MARKUP = LEGACY_TICKS_DELIVERED

function buildMessage(type: MessagePayload['type'], content: string): MessagePayload {
  return {
    id: 'msg-1',
    type,
    direction: 'inbound',
    sender: 'customer',
    timestamp: '2026-08-05T12:00:00.000Z',
    content,
  }
}

describe('MessageText mantém o markup da 0.4.2 por padrão', () => {
  it('G1: texto comum é um div clicável sem role, tabindex nem teclado', () => {
    const markup = renderToStaticMarkup(<MessageText message={buildMessage('text', '*oi*')} />)

    expect(markup).toBe(LEGACY_TEXT_MARKUP)
    expect(markup).not.toContain('role=')
    expect(markup).not.toContain('tabindex')
  })

  it('G2: template continua sendo o parágrafo em itálico', () => {
    const markup = renderToStaticMarkup(<MessageText message={buildMessage('template', 'Olá modelo')} />)

    expect(markup).toBe(LEGACY_TEMPLATE_MARKUP)
  })

  it('G3: o selo de cópia é "Copiado!" com a classe Tailwind exata', () => {
    expect(renderToStaticMarkup(<MessageTextCopiedBadge />)).toBe(LEGACY_COPIED_BADGE_MARKUP)
  })
})

describe('StatusTicks mantém o markup da 0.4.2 por padrão', () => {
  it('G4: sent', () => {
    expect(renderToStaticMarkup(<StatusTicks status="sent" />)).toBe(LEGACY_TICKS_SENT)
  })

  it('G4: delivered', () => {
    expect(renderToStaticMarkup(<StatusTicks status="delivered" />)).toBe(LEGACY_TICKS_DELIVERED)
  })

  it('G4: read', () => {
    expect(renderToStaticMarkup(<StatusTicks status="read" />)).toBe(LEGACY_TICKS_READ)
  })

  it('G4: failed', () => {
    expect(renderToStaticMarkup(<StatusTicks status="failed" />)).toBe(LEGACY_TICKS_FAILED)
  })

  it('G5: status desconhecido desenha dois tiques cinza', () => {
    expect(renderToStaticMarkup(<StatusTicks status="pending" />)).toBe(LEGACY_UNKNOWN_STATUS_MARKUP)
    expect(renderToStaticMarkup(<StatusTicks status="xyz" />)).toBe(LEGACY_UNKNOWN_STATUS_MARKUP)
  })

  it('G5: queued e bounced, que a 0.4.2 nunca recebia, também caem nos dois tiques cinza', () => {
    expect(renderToStaticMarkup(<StatusTicks status="queued" />)).toBe(LEGACY_UNKNOWN_STATUS_MARKUP)
    expect(renderToStaticMarkup(<StatusTicks status="bounced" />)).toBe(LEGACY_UNKNOWN_STATUS_MARKUP)
  })

  it('G6: title vira data-cv-tooltip e nunca aria-label', () => {
    const markup = renderToStaticMarkup(<StatusTicks status="read" title="x" />)

    expect(markup).toBe(LEGACY_TICKS_READ_WITH_TITLE)
    expect(markup).toContain('data-cv-tooltip="x"')
    expect(markup).not.toContain('aria-label')
  })
})

describe('MessageBubble mantém o selo da 0.4.2', () => {
  it('G7: mensagem enviada e lida contém o StatusTicks idêntico ao da 0.4.2', () => {
    const message: MessagePayload = {
      ...buildMessage('text', 'oi'),
      direction: 'outbound',
      sender: 'agent',
      status: 'read',
    }

    expect(renderToStaticMarkup(<MessageBubble message={message} isMine />)).toContain(LEGACY_TICKS_READ)
  })

  it('G7: bounced no balão não vira falha: sem anel de erro e com dois tiques cinza', () => {
    const message: MessagePayload = {
      ...buildMessage('text', 'oi'),
      direction: 'outbound',
      sender: 'agent',
      status: 'bounced',
    }
    const markup = renderToStaticMarkup(<MessageBubble message={message} isMine />)

    expect(markup).toContain(LEGACY_TICKS_DELIVERED)
  })
})
