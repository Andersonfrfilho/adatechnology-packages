/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { parseSesNotification } from './parseSesNotification'

function snsEnvelope(message: unknown): string {
  return JSON.stringify({ Type: 'Notification', Message: JSON.stringify(message) })
}

describe('parseSesNotification', () => {
  it('traduz Delivery', () => {
    const receipt = parseSesNotification(
      snsEnvelope({
        notificationType: 'Delivery',
        mail: { messageId: 'ses-1' },
        delivery: { timestamp: '2026-08-02T10:00:00.000Z' },
      }),
    )

    expect(receipt).toEqual({
      providerMessageId: 'ses-1',
      status: 'delivered',
      occurredAt: new Date('2026-08-02T10:00:00.000Z'),
    })
  })

  it('traduz Bounce com bounceType/bounceSubType como errorCode', () => {
    const receipt = parseSesNotification(
      snsEnvelope({
        notificationType: 'Bounce',
        mail: { messageId: 'ses-1' },
        bounce: { bounceType: 'Permanent', bounceSubType: 'General', timestamp: '2026-08-02T10:00:00.000Z' },
      }),
    )

    expect(receipt).toMatchObject({ status: 'bounced', suppressionReason: 'bounce', errorCode: 'Permanent/General' })
  })

  it('traduz Complaint como failed com supressão de complaint', () => {
    const receipt = parseSesNotification(
      snsEnvelope({
        notificationType: 'Complaint',
        mail: { messageId: 'ses-1' },
        complaint: { complaintFeedbackType: 'abuse', timestamp: '2026-08-02T10:00:00.000Z' },
      }),
    )

    expect(receipt).toMatchObject({ status: 'failed', suppressionReason: 'complaint', errorCode: 'abuse' })
  })

  it('ignora confirmação de assinatura da SNS', () => {
    expect(parseSesNotification(JSON.stringify({ Type: 'SubscriptionConfirmation', Message: '{}' }))).toBeUndefined()
  })

  it('ignora envelope e mensagem interna malformados sem lançar', () => {
    expect(parseSesNotification('não é json')).toBeUndefined()
    expect(parseSesNotification(JSON.stringify({ Type: 'Notification', Message: 'não é json' }))).toBeUndefined()
  })
})
