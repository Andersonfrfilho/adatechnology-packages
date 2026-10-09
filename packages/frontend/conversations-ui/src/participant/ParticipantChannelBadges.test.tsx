import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ParticipantChannelBadges } from './ParticipantChannelBadges'
import { findUtilityClassTokens } from './participantFixtures.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'

const render = (channels: readonly string[] | undefined) =>
  renderToStaticMarkup(
    <ParticipantChannelBadges channels={channels} labels={DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS} />,
  )

describe('ParticipantChannelBadges', () => {
  it('draws nothing without channels, not even the list', () => {
    expect(render(undefined)).toBe('')
    expect(render([])).toBe('')
    expect(render(['sms'])).toBe('')
  })

  it('draws one badge per channel in a stable order with accessible text', () => {
    const markup = render(['whatsapp', 'app'])

    expect(markup).toContain('<ul class="cv-p-channels"')
    expect(markup).toContain('aria-label="Channels in this conversation"')
    expect(markup.indexOf('cv-p-channel--app')).toBeLessThan(markup.indexOf('cv-p-channel--whatsapp'))
    expect(markup).toContain('<span class="cv-p-sr-only">App</span>')
    expect(markup).toContain('<span class="cv-p-sr-only">WhatsApp</span>')
  })

  it('hides the icons from assistive tech and uses no utility classes', () => {
    const markup = render(['app', 'whatsapp', 'email', 'portal', 'webchat'])

    expect(markup.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(5)
    expect(findUtilityClassTokens(markup)).toEqual([])
  })
})
