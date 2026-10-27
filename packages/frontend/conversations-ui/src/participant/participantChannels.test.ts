import { describe, expect, it } from 'bun:test'

import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import {
  PARTICIPANT_CHANNEL_ORDER,
  resolveParticipantChannelLabel,
  resolveParticipantChannels,
} from './participantChannels'

const channelsOf = (input: readonly string[] | undefined) =>
  resolveParticipantChannels(input).map((descriptor) => descriptor.channel)

describe('resolveParticipantChannels', () => {
  it('returns nothing for absent or empty input', () => {
    expect(channelsOf(undefined)).toEqual([])
    expect(channelsOf([])).toEqual([])
  })

  it('orders deterministically whatever the server order', () => {
    expect(channelsOf(['webchat', 'email', 'whatsapp', 'app', 'portal'])).toEqual([
      'app',
      'whatsapp',
      'email',
      'portal',
      'webchat',
    ])
    expect(channelsOf(['whatsapp', 'app'])).toEqual(['app', 'whatsapp'])
  })

  it('dedupes and ignores unknown channels', () => {
    expect(channelsOf(['whatsapp', 'whatsapp', 'sms', 'app'])).toEqual(['app', 'whatsapp'])
  })

  it('maps every channel to an icon and a label', () => {
    expect(PARTICIPANT_CHANNEL_ORDER).toHaveLength(5)
    const labels = PARTICIPANT_CHANNEL_ORDER.map((descriptor) =>
      resolveParticipantChannelLabel(descriptor, DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS),
    )
    expect(labels).toEqual(['App', 'WhatsApp', 'Email', 'Portal', 'Web chat'])
    expect(new Set(PARTICIPANT_CHANNEL_ORDER.map((descriptor) => descriptor.iconName)).size).toBe(5)
  })
})
