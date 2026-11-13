import { describe, expect, it } from 'bun:test'

import type { ChannelCapability } from '@adatechnology/conversation-contracts'

import { channelCapabilityFor } from './channelCapability'
import { CHANNEL_FILTER_ALL, channelFiltersFor, type ConversationChannel } from './conversationChannel'

const MEGABYTE = 1024 * 1024

// Values published by conversation-contracts 0.3.0 (b9f1ef6), read by the 0.4.2 UI.
const LEGACY_WHATSAPP_CAPABILITY: ChannelCapability = {
  confirmsRead: true,
  sessionWindowHours: 24,
  attachments: { accepted: true, maxBytes: 100 * MEGABYTE, maxTotalBytes: null },
  audio: { plays: true, records: true },
  quickReplies: true,
  requiresTransport: false,
  reachableStatuses: ['queued', 'sent', 'delivered', 'read', 'failed'],
}

const LEGACY_EMAIL_CAPABILITY: ChannelCapability = {
  confirmsRead: false,
  sessionWindowHours: null,
  attachments: { accepted: true, maxBytes: 10 * MEGABYTE, maxTotalBytes: 25 * MEGABYTE },
  audio: { plays: true, records: true },
  quickReplies: true,
  requiresTransport: true,
  reachableStatuses: ['queued', 'sent', 'delivered', 'failed', 'bounced'],
}

const LEGACY_WEBCHAT_CAPABILITY: ChannelCapability = {
  confirmsRead: false,
  sessionWindowHours: null,
  attachments: { accepted: true, maxBytes: 10 * MEGABYTE, maxTotalBytes: null },
  audio: { plays: false, records: false },
  quickReplies: true,
  requiresTransport: false,
  reachableStatuses: ['queued', 'delivered', 'failed'],
}

describe('channelCapabilityFor mantém os valores da 0.4.2', () => {
  it('G9: whatsapp', () => {
    expect(channelCapabilityFor('whatsapp')).toEqual(LEGACY_WHATSAPP_CAPABILITY)
  })

  it('G9: email', () => {
    expect(channelCapabilityFor('email')).toEqual(LEGACY_EMAIL_CAPABILITY)
  })

  it('G9: webchat', () => {
    expect(channelCapabilityFor('webchat')).toEqual(LEGACY_WEBCHAT_CAPABILITY)
  })

  it('G9: messenger cai na capacidade do WhatsApp', () => {
    expect(channelCapabilityFor('messenger')).toEqual(LEGACY_WHATSAPP_CAPABILITY)
  })

  it('G9: instagram cai na capacidade do WhatsApp', () => {
    expect(channelCapabilityFor('instagram')).toEqual(LEGACY_WHATSAPP_CAPABILITY)
  })

  it('G9: canal ausente cai na capacidade do WhatsApp', () => {
    expect(channelCapabilityFor(undefined)).toEqual(LEGACY_WHATSAPP_CAPABILITY)
  })
})

describe('channelFiltersFor com canais antigos mantém lista e ordem da 0.4.2', () => {
  it('G9: os cinco canais antigos saem na ordem do catálogo, não na de chegada', () => {
    const channels: ConversationChannel[] = ['email', 'webchat', 'instagram', 'messenger', 'whatsapp']

    expect(channelFiltersFor(channels.map((channel) => ({ channel })))).toEqual([
      { value: CHANNEL_FILTER_ALL, label: 'Todos' },
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'messenger', label: 'Messenger' },
      { value: 'instagram', label: 'Instagram' },
      { value: 'webchat', label: 'Chat do site' },
      { value: 'email', label: 'E-mail' },
    ])
  })

  it('G9: conversa sem canal conta como WhatsApp e um canal só não gera filtro', () => {
    expect(channelFiltersFor([{}, { channel: 'whatsapp' }])).toEqual([])
    expect(channelFiltersFor([{}, { channel: 'email' }])).toEqual([
      { value: CHANNEL_FILTER_ALL, label: 'Todos' },
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'email', label: 'E-mail' },
    ])
  })
})
