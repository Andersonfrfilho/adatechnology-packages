import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { QuickReply } from '../quickReplies/quickReply.types'
import { findForeignClassTokens, findUtilityClassTokens } from './participantFixtures.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { ParticipantComposer, type ParticipantComposerProps } from './ParticipantComposer'

const QUICK_REPLIES: readonly QuickReply[] = [
  { id: '1', title: 'On my way', shortcut: 'way', body: 'I am on my way' },
  { id: '2', title: 'Delivered', shortcut: 'done', body: 'Delivered' },
]

function render(overrides: Partial<ParticipantComposerProps> = {}): string {
  return renderToStaticMarkup(
    <ParticipantComposer
      value=""
      onChange={() => undefined}
      files={[]}
      onFilesChange={() => undefined}
      onSend={() => undefined}
      labels={DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS}
      {...overrides}
    />,
  )
}

describe('ParticipantComposer', () => {
  it('renders a form with a labelled textarea and the maxLength prop', () => {
    const markup = render({ maxLength: 500 })

    expect(markup).toContain('<form')
    expect(markup).toContain('<textarea')
    expect(markup).toContain('maxLength="500"')
    expect(markup).toContain('aria-label="Message"')
  })

  it('disables send without content and enables it with text or files', () => {
    expect(render()).toMatch(/<button[^>]*type="submit"[^>]*disabled/)
    expect(render({ value: 'hi' })).not.toMatch(/<button[^>]*type="submit"[^>]*disabled/)
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    expect(render({ files: [file] })).not.toMatch(/<button[^>]*type="submit"[^>]*disabled/)
  })

  it('disables send when the composer is disabled even with text', () => {
    expect(render({ value: 'hi', disabled: true })).toMatch(/<button[^>]*type="submit"[^>]*disabled/)
  })

  it('renders the hidden multiple file input with accept and the attach button', () => {
    const markup = render({ acceptedTypes: ['image/*'] })

    expect(markup).toContain('type="file"')
    expect(markup).toContain('multiple')
    expect(markup).toContain('accept="image/*"')
    expect(markup).toContain('Attach')
  })

  it('lists chosen files with a remove button', () => {
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    const markup = render({ files: [file] })

    expect(markup).toContain('photo.png')
    expect(markup).toContain('Remove attachment')
  })

  it('renders quick reply chips only when quickReplies is non-empty', () => {
    expect(render()).not.toContain('cv-p-quick')
    expect(render({ quickReplies: [] })).not.toContain('cv-p-quick')
    const markup = render({ quickReplies: QUICK_REPLIES })
    expect(markup).toContain('cv-p-quick')
    expect(markup).toContain('On my way')
    expect(markup).toContain('type="button"')
  })

  it('has no microphone control', () => {
    expect(render({ quickReplies: QUICK_REPLIES }).toLowerCase()).not.toMatch(/microphone|record/)
  })

  it('uses only cv-p-* classes and no Tailwind utilities', () => {
    const markup = render({ quickReplies: QUICK_REPLIES, value: 'x' })

    expect(findUtilityClassTokens(markup)).toEqual([])
    expect(findForeignClassTokens(markup)).toEqual([])
  })
})
