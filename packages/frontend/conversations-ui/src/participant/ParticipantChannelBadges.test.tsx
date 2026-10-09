import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ParticipantChannelBadges } from './ParticipantChannelBadges'
import { findUtilityClassTokens } from './participantFixtures.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'

const render = (channels: readonly string[] | undefined, variant?: 'list' | 'inline') =>
  renderToStaticMarkup(
    <ParticipantChannelBadges
      channels={channels}
      labels={DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS}
      {...(variant === undefined ? {} : { variant })}
    />,
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

  it('inline variant draws spans only, with a group prefix and audible separators', () => {
    const markup = render(['whatsapp', 'app', 'app'], 'inline')

    expect(markup).not.toContain('<ul')
    expect(markup).not.toContain('<li')
    expect(markup).toContain('<span class="cv-p-channels">')
    expect(markup).toContain('<span class="cv-p-sr-only">Channels in this conversation: </span>')
    expect(markup.match(/class="cv-p-channel cv-p-channel--/g)).toHaveLength(2)
    expect(markup.indexOf('cv-p-channel--app')).toBeLessThan(markup.indexOf('cv-p-channel--whatsapp'))
    expect(markup).toContain('<span class="cv-p-sr-only">App, </span>')
    expect(markup).toContain('<span class="cv-p-sr-only">WhatsApp</span>')
    expect(markup.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(2)
  })

  it('inline variant draws nothing without valid channels', () => {
    expect(render(undefined, 'inline')).toBe('')
    expect(render(['sms'], 'inline')).toBe('')
  })
})
