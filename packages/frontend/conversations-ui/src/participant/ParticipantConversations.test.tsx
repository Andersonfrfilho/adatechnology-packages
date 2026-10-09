import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ParticipantConversations } from './ParticipantConversations'
import { ParticipantConversationsScreen, type ParticipantConversationsScreenProps } from './ParticipantConversationsScreen'
import type { ParticipantConversationsApi } from './participantApi.types'
import { buildConversation, findForeignClassTokens, findUtilityClassTokens } from './participantFixtures.test-helper'

const API: ParticipantConversationsApi = {
  listConversations: async () => ({ data: [] }),
  fetchMessages: async () => [],
  sendMessage: async () => ({ outcome: 'queued' }),
  markRead: async () => undefined,
  resolveAttachmentUrl: async () => 'https://files.example/a',
}

const GROUPS = [{ subjectType: 'invoice', label: 'Invoices' }]

function renderScreen(overrides: Partial<ParticipantConversationsScreenProps> = {}): string {
  return renderToStaticMarkup(
    <ParticipantConversationsScreen
      api={API}
      subjectGroups={GROUPS}
      selected={undefined}
      onSelect={() => undefined}
      inbox={{
        status: 'ready',
        conversations: [buildConversation({ subjectId: '1', subjectLabel: 'Invoice 4521' })],
        markSubjectRead: () => undefined,
      }}
      {...overrides}
    />,
  )
}

describe('ParticipantConversations', () => {
  it('renders the list without any ConversationsProvider around it', () => {
    const markup = renderToStaticMarkup(
      <ParticipantConversations api={API} subjectGroups={GROUPS} selected={undefined} onSelect={() => undefined} />,
    )

    expect(markup).toContain('cv-p-inbox')
    expect(findUtilityClassTokens(markup)).toEqual([])
    expect(findForeignClassTokens(markup)).toEqual([])
  })

  it('renders the inbox rows when selected is undefined', () => {
    const markup = renderScreen()

    expect(markup).toContain('cv-p-inbox')
    expect(markup).toContain('Invoice 4521')
    expect(markup).not.toContain('cv-p-thread')
  })

  it('mounts the conversation shell with the subject label when selected is set', () => {
    const markup = renderScreen({ selected: { subjectType: 'invoice', subjectId: '1' } })

    expect(markup).toContain('cv-p-thread__title')
    expect(markup).toContain('Invoice 4521')
    expect(markup).not.toContain('cv-p-inbox')
    expect(findUtilityClassTokens(markup)).toEqual([])
  })

  it('shows the not-found state when the subject is absent and the api cannot open it', () => {
    const markup = renderScreen({ selected: { subjectType: 'invoice', subjectId: '999' } })

    expect(markup).toContain('Conversation not found')
  })

  it('merges partial labels over the defaults', () => {
    const markup = renderScreen({ labels: { inboxTitle: 'Minhas conversas' } })

    expect(markup).toContain('Minhas conversas')
  })

  it('applies the theme as --cv-p-* variables and the class names on the wrapper', () => {
    const markup = renderScreen({
      theme: { primaryColor: '#123456' },
      className: 'host-wrapper',
      classNames: { inbox: 'host-inbox' },
    })

    expect(markup).toContain('--cv-p-accent:#123456')
    expect(markup).toContain('host-wrapper')
    expect(markup).toContain('host-inbox')
  })
})
