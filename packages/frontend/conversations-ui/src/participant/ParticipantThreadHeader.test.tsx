import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { splitBlocks } from '../cssBlocks.test-helper'
import { buildConversation } from './participantFixtures.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { ParticipantProtocolBadgeView } from './ParticipantProtocolBadge'
import { ParticipantThreadHeader, type ParticipantThreadHeaderProps } from './ParticipantThreadHeader'

const LABELS = DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS
const GROUPS = [{ subjectType: 'invoice', label: 'Invoices' }]

function render(overrides: Partial<ParticipantThreadHeaderProps> = {}): string {
  return renderToStaticMarkup(
    <ParticipantThreadHeader
      conversation={buildConversation({ subjectId: '1', subjectLabel: 'Item 4521' })}
      labels={LABELS}
      {...overrides}
    />,
  )
}

function metaOf(markup: string): string {
  const start = markup.indexOf('class="cv-p-thread__meta"')
  const end = markup.indexOf('</header>', start)
  return start === -1 ? '' : markup.slice(start, end)
}

describe('thread header structure', () => {
  const conversation = buildConversation({
    subjectId: '1',
    subjectLabel: 'Item 4521',
    protocol: '261009-K7M2',
    channels: ['app', 'whatsapp'],
  })

  it('draws the eyebrow only when the subject type has a group', () => {
    expect(render({ subjectGroups: GROUPS })).toContain('<p class="cv-p-thread__eyebrow">Invoices</p>')
    expect(render()).not.toContain('cv-p-thread__eyebrow')
    expect(render({ subjectGroups: [{ subjectType: 'other', label: 'Other' }] })).not.toContain('cv-p-thread__eyebrow')
  })

  it('draws the title, clickable only with onOpenSubject', () => {
    expect(render()).toContain('Item 4521')
    expect(render()).not.toContain('cv-p-thread__title-button')
    expect(render({ onOpenSubject: () => undefined })).toContain('cv-p-thread__title-button')
  })

  it('keeps protocol, copy button and channel badges in one single meta line', () => {
    const markup = render({ conversation })
    expect(markup.match(/cv-p-thread__meta"/g)?.length).toBe(1)
    const meta = metaOf(markup)
    expect(meta).toContain('261009-K7M2')
    expect(meta).toContain('cv-p-protocol__copy')
    expect(meta).toContain('cv-p-channel--app')
    expect(meta).toContain('cv-p-channel--whatsapp')
    expect(markup.match(/cv-p-channels/g)?.length).toBe(1)
    expect(markup.indexOf('cv-p-channels')).toBeGreaterThan(markup.indexOf('cv-p-thread__meta'))
  })

  it('does not draw a separate channels row', () => {
    const markup = render({ conversation })
    expect(markup).not.toContain('<ul')
    expect(markup).toContain('<span class="cv-p-channels">')
  })

  it('draws the meta line with channels only when there is no protocol', () => {
    const markup = render({ conversation: buildConversation({ subjectId: '1', channels: ['app'] }) })
    expect(metaOf(markup)).toContain('cv-p-channel--app')
    expect(markup).not.toContain('cv-p-protocol')
  })

  it('draws no meta line without protocol and without channels', () => {
    const markup = render()
    expect(markup).not.toContain('cv-p-thread__meta')
    expect(markup).not.toContain('cv-p-protocol')
    expect(markup).not.toContain('cv-p-channels')
  })

  it('draws the back button only with onBack', () => {
    expect(render()).not.toContain('cv-p-thread__back')
    expect(render({ onBack: () => undefined })).toContain('cv-p-thread__back')
  })
})

describe('copy button as an icon', () => {
  const view = (isCopied: boolean) =>
    renderToStaticMarkup(
      <ParticipantProtocolBadgeView
        protocol="261009-K7M2"
        labels={LABELS}
        copyState={{ copyCount: isCopied ? 1 : 0, isCopied }}
        onCopy={() => undefined}
      />,
    )

  it('has the full accessible name and no visible text', () => {
    const markup = view(false)
    expect(markup).toContain('aria-label="Copy protocol 261009-K7M2"')
    const button = markup.slice(markup.indexOf('<button'), markup.indexOf('</button>'))
    expect(button).toContain('<svg')
    expect(button.replace(/<[^>]+>/g, '')).toBe('')
    expect(markup.replace(/aria-label="[^"]*"/g, '')).not.toContain('Copy protocol')
  })

  it('shows the short confirmation next to the icon while copied', () => {
    const markup = view(true)
    const button = markup.slice(markup.indexOf('<button'), markup.indexOf('</button>'))
    expect(button).toContain(`<span class="cv-p-protocol__copied" aria-hidden="true">${LABELS.protocolCopied}</span>`)
    expect(markup).toMatch(/aria-live="polite"><span>Protocol copied<\/span><\/div>/)
  })

  it('keeps the live region outside the protocol block', () => {
    const markup = view(true)
    const block = markup.slice(markup.indexOf('cv-p-protocol--header'), markup.indexOf('</button>'))
    expect(block).not.toContain('aria-live')
  })
})

const CSS = readFileSync(join(import.meta.dir, '..', 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

function declarationsOf(selector: string): Map<string, string> {
  const declarations = new Map<string, string>()
  for (const { prelude, body } of splitBlocks(CSS)) {
    if (body === undefined || prelude.startsWith('@')) continue
    if (!prelude.split(',').some((entry) => entry.trim() === selector)) continue
    for (const declaration of body.split(';')) {
      const separator = declaration.indexOf(':')
      if (separator === -1) continue
      declarations.set(declaration.slice(0, separator).trim().toLowerCase(), declaration.slice(separator + 1).trim())
    }
  }
  return declarations
}

function toRem(value: string | undefined): number {
  const match = /^(\d*\.?\d+)rem$/.exec(value ?? '')
  return match ? Number(match[1]) : 0
}

describe('thread header CSS', () => {
  it('lays the meta line out as a wrapping flex row', () => {
    const meta = declarationsOf('.cv-p-thread__meta')
    expect(meta.get('display')).toBe('flex')
    expect(meta.get('flex-wrap')).toBe('wrap')
  })

  it('gives the copy button a wide touch area without inflating the line', () => {
    const copy = declarationsOf('.cv-p-protocol__copy')
    expect(toRem(copy.get('min-width'))).toBeGreaterThanOrEqual(2.75)
    expect(toRem(copy.get('min-height'))).toBeGreaterThanOrEqual(2)
    expect(copy.get('margin')).toMatch(/^-/)
  })

  it('sets a floor of 4rem on the header but never a fixed or maximum height', () => {
    const header = declarationsOf('.cv-p-thread__header')
    for (const property of ['height', 'max-height']) expect(header.has(property)).toBe(false)
    expect(toRem(header.get('min-height'))).toBeGreaterThanOrEqual(4)
  })

  it('clamps the title to one line', () => {
    expect(declarationsOf('.cv-p-thread__title-text').get('-webkit-line-clamp')).toBe('1')
  })

  it('draws the eyebrow like the list row kind label', () => {
    const eyebrow = declarationsOf('.cv-p-thread__eyebrow')
    expect(eyebrow.get('text-transform')).toBe('uppercase')
    expect(eyebrow.get('font')).toContain('monospace')
  })
})

describe('avatar CSS', () => {
  it('draws a 2rem box that follows the host radius token', () => {
    const avatar = declarationsOf('.cv-p-avatar')
    expect(avatar.get('width')).toBe('2rem')
    expect(avatar.get('height')).toBe('2rem')
    expect(avatar.get('border-radius')).toBe('var(--cv-p-i-radius)')
  })
})
