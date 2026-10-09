import { describe, expect, it } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'

import { buildConversation, findForeignClassTokens, findUtilityClassTokens } from './participantFixtures.test-helper'
import { groupParticipantConversations } from './participantGrouping'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { ParticipantInbox } from './ParticipantInbox'
import { ParticipantProtocolBadgeView } from './ParticipantProtocolBadge'
import { ParticipantThread } from './ParticipantThread'

const LABELS = DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS
const WITH_PROTOCOL = buildConversation({ subjectId: '1', subjectLabel: 'Item 4521', protocol: '261009-K7M2' })
const WITHOUT_PROTOCOL = buildConversation({ subjectId: '2', subjectLabel: 'Item 9999' })

type InboxOverrides = {
  search?: { value: string; isVisible: boolean }
  hasMore?: boolean
  filter?: string
  hasMatchesOutsideFilter?: boolean
}

function renderInbox(conversations: readonly (typeof WITH_PROTOCOL)[], overrides: InboxOverrides = {}): string {
  const view = {
    ...groupParticipantConversations({ conversations, subjectGroups: [], filter: 'all' }),
    ...(overrides.hasMatchesOutsideFilter === undefined
      ? {}
      : { hasMatchesOutsideFilter: overrides.hasMatchesOutsideFilter }),
  }
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
      hasMore={overrides.hasMore ?? false}
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
    expect(markup).toContain('<span class="cv-p-sr-only">Protocol </span>261009-K7M2')
    expect(markup).not.toMatch(/<span[^>]*aria-label/)
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

  it('names the code with a visually hidden prefix and no aria-label on the generic span', () => {
    const markup = renderThread(WITH_PROTOCOL)
    expect(markup).toContain(`<span class="cv-p-sr-only">${LABELS.protocolPrefix} </span>261009-K7M2`)
    expect(markup).not.toMatch(/<span[^>]*aria-label/)
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

  it('does not nest a status region inside the protocol block', () => {
    const markup = renderThread(WITH_PROTOCOL)
    const block = markup.slice(
      markup.indexOf('cv-p-protocol--header'),
      markup.indexOf('</button>', markup.indexOf('cv-p-protocol__copy')),
    )
    expect(block).not.toContain('role="status"')
    expect(block).not.toContain('aria-live')
  })
})

describe('copy button', () => {
  const render = (isCopied: boolean) =>
    renderToStaticMarkup(
      <ParticipantProtocolBadgeView
        protocol="261009-K7M2"
        labels={LABELS}
        copyState={{ copyCount: isCopied ? 1 : 0, isCopied }}
        onCopy={() => undefined}
      />,
    )

  it('has a default visible label starting the accessible name', () => {
    expect(LABELS.copyProtocol).toBe('Copy protocol')
    const markup = render(false)
    expect(markup).toContain('<span aria-hidden="true">Copy protocol</span>')
    expect(markup).toContain('<span class="cv-p-sr-only">Copy protocol 261009-K7M2</span>')
  })

  it('swaps the visible text for the confirmation while copied, hidden from assistive tech', () => {
    const markup = render(true)
    expect(markup).toContain(`<span aria-hidden="true">${LABELS.protocolCopied}</span>`)
    expect(markup).toContain(`<span>${LABELS.protocolCopied}</span></div>`)
  })

  it('announces only through the live region, keyed by the copy count', () => {
    expect(render(false)).toMatch(/aria-live="polite"><\/div>/)
    expect(render(true)).toMatch(/aria-live="polite"><span>Protocol copied<\/span><\/div>/)
  })
})

describe('inbox empty states', () => {
  const search = { value: 'zzz', isVisible: true }

  it('says the filter is the reason when the query matches in another subject', () => {
    const markup = renderInbox([], { search, hasMatchesOutsideFilter: true })
    expect(markup).toContain(LABELS.noResultsInFilter)
    expect(markup).not.toContain(`>${LABELS.noResults}<`)
  })

  it('says the search covers only the loaded conversations when more exist', () => {
    const markup = renderInbox([], { search, hasMore: true })
    expect(markup).toContain(LABELS.noResultsLoadedOnly)
    expect(markup).toContain(LABELS.loadMore)
  })

  it('keeps the plain message when nothing more can be loaded', () => {
    expect(renderInbox([], { search })).toContain(`>${LABELS.noResults}<`)
  })
})

describe('protocol markup hygiene', () => {
  it('uses only cv-p-* classes and no Tailwind utilities', () => {
    const markup =
      renderInbox([WITH_PROTOCOL], { search: { value: '', isVisible: true } }) + renderThread(WITH_PROTOCOL)
    expect(findUtilityClassTokens(markup)).toEqual([])
    expect(findForeignClassTokens(markup)).toEqual([])
  })

  it('keeps product vocabulary out of the new sources and labels', () => {
    const files = readdirSync(fileURLToPath(new URL('.', import.meta.url))).filter(
      (file) => /\.tsx?$/.test(file) && !/\.test(-helper)?\.tsx?$/.test(file),
    )
    const source = files.map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n')
    expect(files.length).toBeGreaterThan(20)
    expect(source).not.toMatch(
      /\b(carga|entrega|frete|cte|nf-?e|transport\w*|nota|ocorr\w*|motorista|viagem|trip|driver)\b/i,
    )
  })
})
