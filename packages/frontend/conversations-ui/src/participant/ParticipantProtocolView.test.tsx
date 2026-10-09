import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'

import { buildConversation, findForeignClassTokens, findUtilityClassTokens } from './participantFixtures.test-helper'
import { groupParticipantConversations } from './participantGrouping'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { ParticipantInbox } from './ParticipantInbox'
import { ParticipantThread } from './ParticipantThread'

const LABELS = DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS
const WITH_PROTOCOL = buildConversation({ subjectId: '1', subjectLabel: 'Invoice 4521', protocol: '261009-K7M2' })
const WITHOUT_PROTOCOL = buildConversation({ subjectId: '2', subjectLabel: 'Invoice 9999' })

type InboxOverrides = { search?: { value: string; isVisible: boolean } }

function renderInbox(conversations: readonly (typeof WITH_PROTOCOL)[], overrides: InboxOverrides = {}): string {
  const view = groupParticipantConversations({ conversations, subjectGroups: [], filter: 'all' })
  return renderToStaticMarkup(
    <ParticipantInbox
      view={view}
      subjectGroups={[]}
      filter="all"
      onFilterChange={() => undefined}
      onSelect={() => undefined}
      labels={LABELS}
      status="ready"
      refresh={() => undefined}
      hasMore={false}
      loadMore={() => undefined}
      search={overrides.search ? { ...overrides.search, onChange: () => undefined } : undefined}
    />,
  )
}

function renderThread(conversation: typeof WITH_PROTOCOL): string {
  return renderToStaticMarkup(
    <ParticipantThread
      conversation={conversation}
      items={[]}
      hasMore={false}
      labels={LABELS}
      resolveAttachmentUrl={async () => 'https://files.example/a'}
      draft={{ value: '', onChange: () => undefined, files: [], onFilesChange: () => undefined }}
      onSend={() => undefined}
      status="ready"
      refresh={() => undefined}
      scroll={{ ref: { current: null }, onScroll: () => undefined }}
      newMessagesCount={0}
      isSending={false}
    />,
  )
}

describe('protocol in the inbox row', () => {
  it('shows the protocol with an accessible name', () => {
    const markup = renderInbox([WITH_PROTOCOL])
    expect(markup).toContain('cv-p-protocol')
    expect(markup).toContain('261009-K7M2')
    expect(markup).toContain('aria-label="Protocol 261009-K7M2"')
  })

  it('draws nothing when the protocol is absent', () => {
    expect(renderInbox([WITHOUT_PROTOCOL])).not.toContain('cv-p-protocol')
  })
})

describe('inbox search', () => {
  it('is drawn with a label, placeholder and type=search when visible', () => {
    const markup = renderInbox([WITH_PROTOCOL], { search: { value: '', isVisible: true } })
    expect(markup).toContain('type="search"')
    expect(markup).toContain('cv-p-search')
    expect(markup).toContain(LABELS.searchLabel)
    expect(markup).toContain(`placeholder="${LABELS.searchPlaceholder}"`)
  })

  it('is not drawn when hidden or when the prop is absent', () => {
    expect(renderInbox([WITH_PROTOCOL], { search: { value: '', isVisible: false } })).not.toContain('cv-p-search')
    expect(renderInbox([WITH_PROTOCOL])).not.toContain('cv-p-search')
  })

  it('shows the no-results state instead of the empty inbox when a query finds nothing', () => {
    const markup = renderInbox([], { search: { value: 'zzz', isVisible: true } })
    expect(markup).toContain(LABELS.noResults)
    expect(markup).not.toContain(LABELS.emptyInbox)
  })
})

describe('protocol in the thread header', () => {
  it('shows the protocol and a copy button of at least a touch target', () => {
    const markup = renderThread(WITH_PROTOCOL)
    expect(markup).toContain('261009-K7M2')
    expect(markup).toContain('cv-p-protocol__copy')
    expect(markup).toContain('type="button"')
    expect(markup).toContain(LABELS.copyProtocol)
  })

  it('keeps an empty polite live region in the tree', () => {
    const markup = renderThread(WITH_PROTOCOL)
    expect(markup).toMatch(/<div class="cv-p-sr-only" role="status" aria-live="polite"><\/div>/)
    expect(markup).not.toContain(LABELS.protocolCopied)
  })

  it('draws neither protocol nor button nor live region when absent', () => {
    const markup = renderThread(WITHOUT_PROTOCOL)
    expect(markup).not.toContain('cv-p-protocol')
    expect(markup.match(/aria-live="polite"/g)?.length).toBe(1)
  })
})

describe('protocol markup hygiene', () => {
  it('uses only cv-p-* classes and no Tailwind utilities', () => {
    const markup = renderInbox([WITH_PROTOCOL], { search: { value: '', isVisible: true } }) + renderThread(WITH_PROTOCOL)
    expect(findUtilityClassTokens(markup)).toEqual([])
    expect(findForeignClassTokens(markup)).toEqual([])
  })

  it('keeps product vocabulary out of the new sources and labels', () => {
    const files = ['participantProtocol.ts', 'participantProtocolCopy.ts', 'participantLabels.ts', 'ParticipantInbox.tsx', 'ParticipantThread.tsx', 'ParticipantProtocolBadge.tsx']
    const source = files.map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n')
    expect(source).not.toMatch(/\bnota\b|ocorr|motorista|viagem|\btrip\b|\bdriver\b/i)
  })
})
