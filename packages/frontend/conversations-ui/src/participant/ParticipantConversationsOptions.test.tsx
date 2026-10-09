import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { ParticipantConversationsApi } from './participantApi.types'
import { buildConversation, buildMessage } from './participantFixtures.test-helper'
import type { ParticipantConversationsScreenProps } from './ParticipantConversationsScreen'
import * as realThreadModule from './useParticipantThread'

const MESSAGES = [
  buildMessage({ id: 'a', authorName: 'Ana Souza', createdAt: '2026-10-01T10:00:00.000Z' }),
  buildMessage({ id: 'b', direction: 'inbound', createdAt: '2026-10-01T10:01:00.000Z' }),
]
const realUseParticipantThread = realThreadModule.useParticipantThread
let isInjecting = false

const API: ParticipantConversationsApi = {
  listConversations: async () => ({ data: [] }),
  fetchMessages: async () => [],
  sendMessage: async () => ({ outcome: 'queued' }),
  markRead: async () => undefined,
  resolveAttachmentUrl: async () => 'https://files.example/a',
}

let ParticipantConversationsScreen: typeof import('./ParticipantConversationsScreen').ParticipantConversationsScreen

beforeAll(async () => {
  // Server rendering runs no effects, so the messages are injected over the real hook.
  mock.module('./useParticipantThread', () => ({
    ...realThreadModule,
    useParticipantThread: (...args: Parameters<typeof realUseParticipantThread>) => {
      const result = realUseParticipantThread(...args)
      return isInjecting ? { ...result, messages: MESSAGES, status: 'ready' as const } : result
    },
  }))
  ParticipantConversationsScreen = (await import('./ParticipantConversationsScreen')).ParticipantConversationsScreen
  isInjecting = true
})

afterAll(() => {
  isInjecting = false
})

function renderThread(overrides: Partial<ParticipantConversationsScreenProps> = {}): string {
  return renderToStaticMarkup(
    <ParticipantConversationsScreen
      api={API}
      subjectGroups={[{ subjectType: 'invoice', label: 'Invoices' }]}
      selected={{ subjectType: 'invoice', subjectId: '1' }}
      onSelect={() => undefined}
      inbox={{
        status: 'ready',
        conversations: [buildConversation({ subjectId: '1', subjectLabel: 'Invoice 4521' })],
        hasMore: false,
        refresh: async () => undefined,
        loadMore: async () => undefined,
        markSubjectRead: () => undefined,
      }}
      {...overrides}
    />,
  )
}

describe('participant options reach the DOM through the screen', () => {
  it('injects the messages (sanity)', () => {
    expect(renderThread()).toContain('cv-p-bubble--mine')
  })

  it('draws the group eyebrow from subjectGroups', () => {
    expect(renderThread()).toContain('<p class="cv-p-thread__eyebrow">Invoices</p>')
  })

  it('draws no avatar by default and the initials with avatars="initials"', () => {
    expect(renderThread()).not.toContain('cv-p-avatar')
    expect(renderThread({ avatars: 'initials' })).toContain('class="cv-p-avatar" aria-hidden="true">AS<')
  })

  it('draws the host slot through renderAuthorAvatar', () => {
    const markup = renderThread({ renderAuthorAvatar: () => <i>PHOTO</i> })
    expect(markup).toContain('<i>PHOTO</i>')
  })

  it('keeps the tail by default and removes it from every bubble with tail={false}', () => {
    expect(renderThread()).not.toContain('cv-p-bubble--no-tail')
    const markup = renderThread({ tail: false })
    expect(markup.match(/cv-p-bubble--no-tail/g)?.length).toBe(2)
  })
})
