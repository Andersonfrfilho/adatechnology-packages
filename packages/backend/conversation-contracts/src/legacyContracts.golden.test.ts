import { describe, expect, it } from 'bun:test'

import * as contracts from './index'
import * as ports from './ports'
import * as requestSchemas from './requestSchemas'

const MEGABYTE = 1024 * 1024

// Everything below is the 0.3.0 surface (b9f1ef6). Additions are allowed; changes and removals are not.
const LEGACY_RUNTIME_EXPORTS = [
  'CONVERSATION_CHANNEL',
  'MESSAGE_DIRECTION',
  'MESSAGE_DELIVERY_STATUS',
  'DKIM_RESULT',
  'ATTACHMENT_KIND',
  'conversationChannelSchema',
  'messageDirectionSchema',
  'messageDeliveryStatusSchema',
  'dkimResultSchema',
  'attachmentKindSchema',
  'CHANNEL_CAPABILITIES',
  'getChannelCapabilities',
  'advanceDeliveryStatus',
  'openConversationParticipantSchema',
  'openConversationBodySchema',
  'sendMessageBodySchema',
  'markConversationReadBodySchema',
  'quickReplyBodySchema',
]

const LEGACY_CAPABILITIES = {
  email: {
    confirmsRead: false,
    sessionWindowHours: null,
    attachments: { accepted: true, maxBytes: 10 * MEGABYTE, maxTotalBytes: 25 * MEGABYTE },
    audio: { plays: true, records: true },
    quickReplies: true,
    requiresTransport: true,
    reachableStatuses: ['queued', 'sent', 'delivered', 'failed', 'bounced'],
  },
  whatsapp: {
    confirmsRead: true,
    sessionWindowHours: 24,
    attachments: { accepted: true, maxBytes: 100 * MEGABYTE, maxTotalBytes: null },
    audio: { plays: true, records: true },
    quickReplies: true,
    requiresTransport: false,
    reachableStatuses: ['queued', 'sent', 'delivered', 'read', 'failed'],
  },
  app: {
    confirmsRead: true,
    sessionWindowHours: null,
    attachments: { accepted: true, maxBytes: 25 * MEGABYTE, maxTotalBytes: null },
    audio: { plays: true, records: true },
    quickReplies: true,
    requiresTransport: false,
    reachableStatuses: ['queued', 'delivered', 'read'],
  },
  portal: {
    confirmsRead: true,
    sessionWindowHours: null,
    attachments: { accepted: true, maxBytes: 25 * MEGABYTE, maxTotalBytes: null },
    audio: { plays: true, records: false },
    quickReplies: true,
    requiresTransport: false,
    reachableStatuses: ['delivered', 'read'],
  },
  webchat: {
    confirmsRead: false,
    sessionWindowHours: null,
    attachments: { accepted: true, maxBytes: 10 * MEGABYTE, maxTotalBytes: null },
    audio: { plays: false, records: false },
    quickReplies: true,
    requiresTransport: false,
    reachableStatuses: ['queued', 'delivered', 'failed'],
  },
}

describe('o contrato publicado na 0.3.0 não mudou (G10)', () => {
  it('CONVERSATION_CHANNEL tem os mesmos cinco canais, na mesma ordem', () => {
    expect([...contracts.CONVERSATION_CHANNEL]).toEqual(['email', 'whatsapp', 'app', 'portal', 'webchat'])
  })

  it('MESSAGE_DELIVERY_STATUS tem os mesmos seis estados, na mesma ordem', () => {
    expect([...contracts.MESSAGE_DELIVERY_STATUS]).toEqual(['queued', 'sent', 'delivered', 'read', 'failed', 'bounced'])
  })

  it('CHANNEL_CAPABILITIES tem os mesmos valores por canal', () => {
    expect(contracts.CHANNEL_CAPABILITIES).toEqual(LEGACY_CAPABILITIES as never)
  })

  it('ports continua sem export de runtime e requestSchemas com as mesmas cinco chaves', () => {
    expect(Object.keys(ports)).toEqual([])
    expect(Object.keys(requestSchemas).sort()).toEqual([
      'markConversationReadBodySchema',
      'openConversationBodySchema',
      'openConversationParticipantSchema',
      'quickReplyBodySchema',
      'sendMessageBodySchema',
    ])
  })

  it('o índice ainda exporta tudo o que a 0.3.0 exportava', () => {
    const exported = Object.keys(contracts)

    expect(LEGACY_RUNTIME_EXPORTS.filter((name) => !exported.includes(name))).toEqual([])
  })
})
