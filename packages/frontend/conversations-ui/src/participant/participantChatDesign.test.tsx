import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { declarationsIn, mediaBody } from './participantCss.test-helper'
import {
  buildConversation,
  buildMessage,
  findForeignClassTokens,
  findUtilityClassTokens,
} from './participantFixtures.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { ParticipantComposer } from './ParticipantComposer'
import { ParticipantThread } from './ParticipantThread'

const LABELS = DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS

function renderThread(): string {
  return renderToStaticMarkup(
    <ParticipantThread
      conversation={buildConversation({ subjectId: '1' })}
      items={[
        { kind: 'server', message: buildMessage({ id: 'a', text: 'Hello', createdAt: '2026-10-01T10:00:00.000Z' }) },
        { kind: 'server', message: buildMessage({ id: 'b', text: 'Again', createdAt: '2026-10-02T10:00:00.000Z' }) },
      ]}
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

function renderComposer(overrides: { value?: string } = {}): string {
  return renderToStaticMarkup(
    <ParticipantComposer
      value={overrides.value ?? ''}
      onChange={() => undefined}
      files={[]}
      onFilesChange={() => undefined}
      onSend={() => undefined}
      labels={LABELS}
      quickReplies={[{ id: '1', title: 'Hi', shortcut: 'hi', body: 'Hi' }]}
    />,
  )
}

describe('wallpaper', () => {
  it('is drawn on the message scroller from the token, defaulting to a CSS-only pattern', () => {
    const scroller = declarationsIn('.cv-p-thread__scroll')
    expect(scroller.get('background-image')).toBe('var(--cv-p-wallpaper, var(--cv-p-i-wallpaper))')
    const root = declarationsIn('.cv-p')
    expect(root.get('--cv-p-i-wallpaper')).toContain('radial-gradient')
    expect(root.get('--cv-p-i-wallpaper')).not.toContain('url(')
    expect(root.get('--cv-p-i-wallpaper-ink')).toBe('var(--cv-p-i-border)')
  })

  it('is switched off in forced colors and in print', () => {
    for (const query of ['(forced-colors: active)', 'print']) {
      expect(declarationsIn('.cv-p-thread__scroll', mediaBody(query) ?? '').get('background-image')).toBe('none')
    }
  })

  it('uses logical properties for the text, the meta and the title button, so RTL mirrors', () => {
    expect(declarationsIn('.cv-p-bubble > .cv-message-text').get('margin-inline-end')).toBe('auto')
    expect(declarationsIn('.cv-p-thread__title-button').get('text-align')).toBe('start')
  })

  it('restores the bubble corner radius in print, where the tail is off', () => {
    const rule = declarationsIn('.cv-p-bubble', mediaBody('print') ?? '')
    expect(rule.get('border-radius')).toBe('var(--cv-p-i-radius)')
    expect(declarationsIn('.cv-p-bubble--mine', mediaBody('print') ?? '').get('border-radius')).toBe(
      'var(--cv-p-i-radius)',
    )
  })

  it('never reaches the composer, the header or the bubbles', () => {
    for (const selector of ['.cv-p-composer', '.cv-p-thread__header', '.cv-p-bubble']) {
      expect(declarationsIn(selector).has('background-image')).toBe(false)
    }
  })
})

describe('day pill', () => {
  it('is a separator holding a time with a machine date', () => {
    expect(renderThread()).toMatch(
      /<div class="cv-p-day" role="separator" aria-label="[^"]+"><time class="cv-p-day__label" dateTime="2026-10-01">/,
    )
  })

  it('is a centred raised pill with a border and the radius token', () => {
    const day = declarationsIn('.cv-p-day')
    expect(day.get('align-self')).toBe('center')
    expect(day.get('background')).toBe('var(--cv-p-i-surface-raised)')
    expect(day.get('border')).toBe('1px solid var(--cv-p-i-border)')
    expect(day.get('border-radius')).toBe('var(--cv-p-i-radius)')
    expect(day.get('font')).toContain('monospace')
  })
})

describe('time and ticks at the foot of the bubble', () => {
  it('keeps time and status together in the last element of the bubble', () => {
    const markup = renderToStaticMarkup(
      <ParticipantThread
        conversation={buildConversation({ subjectId: '1' })}
        items={[{ kind: 'server', message: buildMessage({ id: 'a', direction: 'inbound', text: 'Hello' }) }]}
        hasMore={false}
        labels={LABELS}
        resolveAttachmentUrl={async () => ''}
        draft={{ value: '', onChange: () => undefined, files: [], onFilesChange: () => undefined }}
        onSend={() => undefined}
        status="ready"
        refresh={() => undefined}
        scroll={{ ref: { current: null }, onScroll: () => undefined }}
        newMessagesCount={0}
        isSending={false}
      />,
    )
    const meta = markup.slice(
      markup.indexOf('cv-p-bubble__meta'),
      markup.indexOf('</span></div>', markup.indexOf('cv-p-bubble__meta')),
    )
    expect(meta).toContain('<time')
    expect(meta).toContain('cv-p-bubble__status')
    expect(meta.indexOf('<time')).toBeLessThan(meta.indexOf('cv-p-bubble__status'))
  })

  it('lets the text and the meta share a line, and the meta fall to the right when it does not fit', () => {
    const bubble = declarationsIn('.cv-p-bubble')
    expect(bubble.get('display')).toBe('flex')
    expect(bubble.get('flex-wrap')).toBe('wrap')
    expect(bubble.get('align-items')).toBe('flex-end')
    expect(bubble.get('max-width')).toBe('85%')
    const meta = declarationsIn('.cv-p-bubble__meta')
    expect(meta.get('margin-inline-start')).toBe('auto')
    expect(meta.get('flex')).toBe('0 0 auto')
    expect(declarationsIn('.cv-p-bubble > .cv-message-text').get('min-width')).toBe('0')
  })

  it('keeps author, attachments and failed actions on their own full-width row', () => {
    expect(declarationsIn('.cv-p-bubble__author').get('flex')).toBe('1 0 100%')
    expect(declarationsIn('.cv-p-bubble > .cv-p-attachment').get('flex')).toBe('1 0 100%')
  })
})

describe('composer', () => {
  it('draws attach and send as lucide icons with accessible names and no text glyphs', () => {
    const markup = renderComposer({ value: 'x' })
    const attach = markup.slice(
      markup.indexOf('cv-p-composer__attach'),
      markup.indexOf('</button>', markup.indexOf('cv-p-composer__attach')),
    )
    expect(attach).toContain('aria-label="Attach"')
    expect(attach).toContain('<svg')
    const send = markup.slice(
      markup.indexOf('type="submit"'),
      markup.indexOf('</button>', markup.indexOf('type="submit"')),
    )
    expect(send).toContain('aria-label="Send"')
    expect(send).toContain('<svg')
    for (const glyph of ['＋', '➤', '+']) expect(markup).not.toContain(glyph)
    expect(findUtilityClassTokens(markup)).toEqual([])
    expect(findForeignClassTokens(markup)).toEqual([])
  })

  it('orders attach, field and send in one row, with the chips above it', () => {
    const markup = renderComposer()
    const order = ['cv-p-quick', 'cv-p-composer__row', 'cv-p-composer__attach', '<textarea', 'type="submit"']
    const positions = order.map((token) => markup.indexOf(token))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(positions.every((position) => position >= 0)).toBe(true)
  })

  it('aligns the row by the base, with a field that grows up to four lines and keeps 44px', () => {
    expect(declarationsIn('.cv-p-composer__row').get('align-items')).toBe('flex-end')
    const input = declarationsIn('.cv-p-composer__input')
    expect(input.get('min-height')).toBe('var(--cv-p-i-touch)')
    expect(input.get('max-height')).toBe('6.5rem')
    expect(input.get('overflow-y')).toBe('auto')
    expect(input.get('border-radius')).toBe('var(--cv-p-i-radius)')
    for (const selector of ['.cv-p-composer__attach']) {
      expect(declarationsIn(selector).get('min-width')).toBe('var(--cv-p-i-touch)')
      expect(declarationsIn(selector).get('min-height')).toBe('var(--cv-p-i-touch)')
    }
  })

  it('sits on a raised bar with a top border; send is the primary button', () => {
    const bar = declarationsIn('.cv-p-composer')
    expect(bar.get('background')).toBe('var(--cv-p-i-surface-raised)')
    expect(bar.get('border-top')).toBe('1px solid var(--cv-p-i-border)')
    expect(renderComposer()).toContain('class="cv-p-button cv-p-button--primary cv-p-composer__send"')
  })
})
