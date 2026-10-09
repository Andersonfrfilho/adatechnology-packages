import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { ParticipantMessage } from '@adatechnology/conversation-contracts'

import type { ConversationThreadApi } from './conversationThreadApi'
import type { ConversationThreadProps } from './ConversationThread'
import { buildMessage, findForeignClassTokens, findUtilityClassTokens } from './participantFixtures.test-helper'
import * as realThreadModule from './useParticipantThread'

const COUNTERPART = buildMessage({
  id: 'a',
  direction: 'inbound',
  authorName: 'Ana Souza',
  createdAt: '2026-10-01T10:00:00.000Z',
})
const OWN_READ = buildMessage({ id: 'b', direction: 'outbound', status: 'read', createdAt: '2026-10-01T10:01:00.000Z' })
const OWN_DELIVERED = buildMessage({
  id: 'c',
  direction: 'outbound',
  status: 'delivered',
  createdAt: '2026-10-01T10:02:00.000Z',
})

const realUseParticipantThread = realThreadModule.useParticipantThread
let injected: readonly ParticipantMessage[] | undefined

const API: ConversationThreadApi = {
  fetchMessages: async () => [],
  sendMessage: async () => ({ outcome: 'queued' }),
  resolveAttachmentUrl: async () => 'https://files.example/a',
}

let ConversationThread: typeof import('./ConversationThread').ConversationThread

beforeAll(async () => {
  // Server rendering runs no effects, so the messages are injected over the real hook.
  mock.module('./useParticipantThread', () => ({
    ...realThreadModule,
    useParticipantThread: (...args: Parameters<typeof realUseParticipantThread>) => {
      const result = realUseParticipantThread(...args)
      return injected ? { ...result, messages: injected, status: 'ready' as const } : result
    },
  }))
  ConversationThread = (await import('./ConversationThread')).ConversationThread
})

afterAll(() => {
  injected = undefined
})

function render(messages: readonly ParticipantMessage[], overrides: Partial<ConversationThreadProps> = {}): string {
  injected = messages
  return renderToStaticMarkup(
    <ConversationThread api={API} subject={{ subjectType: 'case', subjectId: '7' }} title="Case 7" {...overrides} />,
  )
}

function bubblesOf(markup: string): string[] {
  return markup.split('<div class="cv-p-bubble').slice(1)
}

describe('ConversationThread, operator perspective', () => {
  const MESSAGES = [COUNTERPART, OWN_READ, OWN_DELIVERED]

  it('owns the outbound messages and not the inbound ones', () => {
    const bubbles = bubblesOf(render(MESSAGES, { perspective: 'operator' }))
    expect(bubbles.map((bubble) => bubble.startsWith(' cv-p-bubble--mine'))).toEqual([false, true, true])
  })

  it('draws the ticks on the operator messages only', () => {
    const [received, readOwn, deliveredOwn] = bubblesOf(render(MESSAGES, { perspective: 'operator' }))
    expect(received).not.toContain('cv-status-ticks')
    expect(readOwn).toContain('cv-status-ticks--read')
    expect(deliveredOwn).toContain('cv-status-ticks--delivered')
  })

  it('draws the initials on the counterpart and never on the operator messages', () => {
    const markup = render(MESSAGES, { perspective: 'operator', avatars: 'initials' })
    expect(markup.match(/class="cv-p-avatar" aria-hidden="true">AS</g)?.length).toBe(1)
    expect(markup.match(/class="cv-p-bubble-row"/g)?.length).toBe(1)
    expect(render([OWN_READ, OWN_DELIVERED], { perspective: 'operator', avatars: 'initials' })).not.toContain(
      'cv-p-avatar',
    )
  })

  it('labels the received bubble with the author name', () => {
    expect(render(MESSAGES, { perspective: 'operator' })).toContain(
      '<span class="cv-p-bubble__author">Ana Souza</span>',
    )
  })
})

describe('ConversationThread, default perspective', () => {
  const MESSAGES = [COUNTERPART, OWN_READ]

  it('is the participant: inbound is mine, and naming it explicitly changes nothing', () => {
    const implicit = render(MESSAGES)
    expect(bubblesOf(implicit).map((bubble) => bubble.startsWith(' cv-p-bubble--mine'))).toEqual([true, false])
    expect(render(MESSAGES, { perspective: 'participant' })).toBe(implicit)
  })
})

describe('ConversationThread, header and footer', () => {
  it('shows the host actions and the counterpart line in the header, and nothing without them', () => {
    const plain = render([COUNTERPART])
    expect(plain).not.toContain('cv-p-thread__actions')
    expect(plain).not.toContain('cv-p-thread__counterpart')
    const markup = render([COUNTERPART], {
      headerActions: <button type="button">Close</button>,
      counterpartLabel: 'Participant: Ana',
    })
    expect(markup).toContain('<div class="cv-p-thread__actions"><button type="button">Close</button></div>')
    expect(markup).toContain('<p class="cv-p-thread__counterpart">Participant: Ana</p>')
    expect(markup.indexOf('cv-p-thread__actions')).toBeLessThan(markup.indexOf('</header>'))
  })

  it('removes the composer and shows the notice when closed, and keeps it when open', () => {
    const closed = render([COUNTERPART], { status: 'closed', perspective: 'operator' })
    expect(closed).toContain('This conversation is closed')
    expect(closed).not.toContain('<form')
    expect(render([COUNTERPART], { status: 'open' })).toContain('<form')
    expect(render([COUNTERPART])).toContain('<form')
  })

  it('draws the title, protocol and channels only from what the host gave', () => {
    expect(render([COUNTERPART])).not.toContain('cv-p-protocol')
    expect(render([COUNTERPART])).not.toContain('cv-p-channels')
    const markup = render([COUNTERPART], { protocol: '261009-K7M2', channels: ['app', 'whatsapp'] })
    expect(markup).toContain('261009-K7M2')
    expect(markup).toContain('cv-p-channel--whatsapp')
    expect(markup).toContain('Case 7')
  })

  it('draws no back arrow without onBack', () => {
    expect(render([COUNTERPART])).not.toContain('cv-p-thread__back')
    expect(render([COUNTERPART], { onBack: () => undefined })).toContain('cv-p-thread__back')
  })

  it('offers quick replies as plain buttons that only fill the field', () => {
    const markup = render([COUNTERPART], {
      quickReplies: [{ id: '1', title: 'Thanks', shortcut: 'ty', body: 'Thank you' }],
    })
    const chips = [...markup.matchAll(/<button[^>]*class="cv-p-chip"[^>]*>/g)].map((match) => match[0])
    expect(chips).toHaveLength(1)
    expect(chips[0]).toContain('type="button"')
    expect(render([COUNTERPART])).not.toContain('cv-p-quick')
  })

  it('applies the theme and the class on a wrapper and uses only the package classes', () => {
    const markup = render([COUNTERPART, OWN_READ], {
      theme: { primaryColor: '#123456' },
      className: 'host-panel',
      onBack: () => undefined,
    })
    expect(markup).toContain('--cv-p-accent:#123456')
    expect(markup).toContain('cv-p-root host-panel')
    expect(findUtilityClassTokens(markup.replace('host-panel', ''))).toEqual([])
    expect(findForeignClassTokens(markup.replace('host-panel', ''))).toEqual([])
  })

  it('draws the conversation without any provider or list around it', () => {
    expect(render([])).toContain('cv-p-thread__title')
  })
})
