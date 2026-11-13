import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { buildConversation, findForeignClassTokens, findUtilityClassTokens } from './participantFixtures.test-helper'
import { groupParticipantConversations } from './participantGrouping'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import type { ParticipantSubjectGroup } from './participant.types'
import { ParticipantInbox, type ParticipantInboxProps } from './ParticipantInbox'

const GROUPS: readonly ParticipantSubjectGroup[] = [
  { subjectType: 'invoice', label: 'Invoice' },
  { subjectType: 'incident', label: 'Incident' },
]

const CONVERSATIONS = [
  buildConversation({
    subjectId: '1',
    subjectLabel: 'Awaiting one',
    awaitingParticipant: true,
    unreadCount: 2,
    lastMessagePreview: 'Please send the photo',
  }),
  buildConversation({ subjectId: '2', subjectLabel: 'Invoice two' }),
  buildConversation({ subjectId: '3', subjectType: 'incident', subjectLabel: 'Incident three' }),
  buildConversation({ subjectId: '4', subjectLabel: 'Old one', status: 'closed' }),
]

type RenderOverrides = {
  conversations?: typeof CONVERSATIONS
  filter?: string
  status?: 'idle' | 'loading' | 'ready' | 'error'
  hasMore?: boolean
  renderSubjectIcon?: ParticipantInboxProps['renderSubjectIcon']
}

function render(overrides: RenderOverrides = {}): string {
  const view = groupParticipantConversations({
    conversations: overrides.conversations ?? CONVERSATIONS,
    subjectGroups: GROUPS,
    filter: overrides.filter,
  })
  return renderToStaticMarkup(
    <ParticipantInbox
      view={view}
      subjectGroups={GROUPS}
      filter={overrides.filter ?? 'all'}
      onFilterChange={() => undefined}
      onSelect={() => undefined}
      labels={DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS}
      status={overrides.status ?? 'ready'}
      refresh={() => undefined}
      hasMore={overrides.hasMore ?? false}
      loadMore={() => undefined}
      renderSubjectIcon={overrides.renderSubjectIcon}
    />,
  )
}

describe('ParticipantInbox channels and subject icon', () => {
  const withChannels = [
    buildConversation({ subjectId: '9', subjectLabel: 'Chatty', channels: ['whatsapp', 'app'], iconName: 'file-text' }),
  ]

  it('shows channel badges only when the conversation has channels', () => {
    expect(render({ conversations: withChannels })).toContain('cv-p-channel--app')
    expect(render()).not.toContain('cv-p-channels')
  })

  it('keeps the badge order stable and the accessible text present', () => {
    const markup = render({ conversations: withChannels })

    expect(markup.indexOf('cv-p-channel--app')).toBeLessThan(markup.indexOf('cv-p-channel--whatsapp'))
    expect(markup).toContain('<span class="cv-p-sr-only">WhatsApp</span>')
  })

  it('row badges are phrasing content: no list inside the row button, header keeps its list', () => {
    const markup = render({ conversations: withChannels })
    const button = markup.slice(markup.indexOf('<button'), markup.indexOf('</button>'))

    expect(button).toContain('cv-p-channels')
    expect(button).not.toContain('<ul')
    expect(button).not.toContain('<li')
    expect(button).toContain('Channels in this conversation: ')
  })

  it('treats false and empty string from renderSubjectIcon as absent', () => {
    const groups = [{ subjectType: 'invoice', label: 'Invoice', icon: 'GRP' }]
    const view = groupParticipantConversations({ conversations: withChannels, subjectGroups: groups })
    const renderWith = (renderSubjectIcon: ParticipantInboxProps['renderSubjectIcon']) =>
      renderToStaticMarkup(
        <ParticipantInbox
          view={view}
          subjectGroups={groups}
          filter="all"
          onFilterChange={() => undefined}
          onSelect={() => undefined}
          labels={DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS}
          status="ready"
          refresh={() => undefined}
          hasMore={false}
          loadMore={() => undefined}
          renderSubjectIcon={renderSubjectIcon}
        />,
      )

    expect(renderWith(() => false)).toContain('GRP')
    expect(renderWith(() => '')).toContain('GRP')
    expect(renderWith(() => <i data-custom="1" />)).not.toContain('GRP')
  })

  it('uses renderSubjectIcon when it returns a node', () => {
    const markup = render({
      renderSubjectIcon: (conversation) => <i data-icon={conversation.iconName ?? 'none'} />,
      conversations: withChannels,
    })

    expect(markup).toContain('cv-p-inbox__icon')
    expect(markup).toContain('data-icon="file-text"')
  })

  it('falls back to the group icon when renderSubjectIcon returns null or undefined', () => {
    const groups = [{ subjectType: 'invoice', label: 'Invoice', icon: 'GRP' }]
    const view = groupParticipantConversations({ conversations: withChannels, subjectGroups: groups })
    const renderWith = (renderSubjectIcon: ParticipantInboxProps['renderSubjectIcon']) =>
      renderToStaticMarkup(
        <ParticipantInbox
          view={view}
          subjectGroups={groups}
          filter="all"
          onFilterChange={() => undefined}
          onSelect={() => undefined}
          labels={DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS}
          status="ready"
          refresh={() => undefined}
          hasMore={false}
          loadMore={() => undefined}
          renderSubjectIcon={renderSubjectIcon}
        />,
      )

    expect(renderWith(() => null)).toContain('GRP')
    expect(renderWith(() => undefined)).toContain('GRP')
    expect(renderWith(undefined)).toContain('GRP')
    expect(renderWith(() => <i data-custom="1" />)).not.toContain('GRP')
  })
})

describe('ParticipantInbox', () => {
  it('renders section headers with label and count, awaiting highlighted', () => {
    const markup = render()

    expect(markup).toContain('Waiting for your reply')
    expect(markup).toContain('cv-p-section--awaiting')
    expect(markup).toContain('Invoice')
    expect(markup).toContain('Incident')
  })

  it('renders rows as buttons with the subject label as text and the preview', () => {
    const markup = render()

    expect(markup).toContain('<button')
    expect(markup).toContain('Awaiting one')
    expect(markup).toContain('Please send the photo')
    expect(markup).toContain('cv-p-row__kind')
    expect(markup).toContain('cv-p-row--awaiting')
  })

  it('shows an unread badge with accessible text only when there are unread messages', () => {
    const markup = render()

    expect(markup).toContain('2 unread')
    expect(markup.match(/cv-p-row__unread/g)?.length).toBe(1)
  })

  it('puts closed conversations inside a collapsible details', () => {
    const markup = render()

    expect(markup).toContain('<details')
    expect(markup).toContain('Closed')
    expect(markup).toContain('Old one')
  })

  it('renders filters only when showFilters is true', () => {
    const withFilters = render()
    const single = render({ conversations: [CONVERSATIONS[1] as (typeof CONVERSATIONS)[number]] })

    expect(withFilters).toContain('cv-p-filters')
    expect(withFilters).toContain('aria-pressed="true"')
    expect(single).not.toContain('cv-p-filters')
  })

  it('renders the empty state when there are no sections', () => {
    const markup = render({ conversations: [] })

    expect(markup).toContain('No conversations yet')
    expect(markup).not.toContain('cv-p-row"')
  })

  it('while loading shows a busy skeleton and never the empty state', () => {
    const markup = render({ conversations: [], status: 'loading' })

    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain('Loading…')
    expect(markup).not.toContain('No conversations yet')
    expect(render({ conversations: [], status: 'idle' })).not.toContain('No conversations yet')
  })

  it('on error shows an alert with retry and never the empty state', () => {
    const markup = render({ conversations: [], status: 'error' })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('Could not load')
    expect(markup).toContain('Retry')
    expect(markup).not.toContain('No conversations yet')
    expect(markup).not.toContain('aria-busy="true"')
  })

  it('on success shows the empty state without busy or alert', () => {
    const markup = render({ conversations: [], status: 'ready' })

    expect(markup).toContain('No conversations yet')
    expect(markup).not.toContain('role="alert"')
    expect(markup).toContain('aria-busy="false"')
  })

  it('keeps the rows and adds the alert when a later request fails', () => {
    const markup = render({ status: 'error' })

    expect(markup).toContain('Awaiting one')
    expect(markup).toContain('role="alert"')
  })

  it('shows load more only when there is a next page', () => {
    expect(render()).not.toContain('Load more')
    expect(render({ hasMore: true })).toContain('Load more')
  })

  it('uses only cv-p-* classes and no Tailwind utilities', () => {
    const markup = render()

    expect(findUtilityClassTokens(markup)).toEqual([])
    expect(findForeignClassTokens(markup)).toEqual([])
  })
})
