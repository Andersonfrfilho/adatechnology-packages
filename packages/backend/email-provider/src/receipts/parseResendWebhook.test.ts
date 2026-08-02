/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { parseResendWebhook } from './parseResendWebhook'

describe('parseResendWebhook', () => {
  it('traduz email.delivered', () => {
    const receipt = parseResendWebhook({
      type: 'email.delivered',
      created_at: '2026-08-02T10:00:00.000Z',
      data: { email_id: 'email_123' },
    })

    expect(receipt).toEqual({
      providerMessageId: 'email_123',
      status: 'delivered',
      occurredAt: new Date('2026-08-02T10:00:00.000Z'),
    })
  })

  it('traduz email.bounced com o subtipo como errorCode e marca supressão de bounce', () => {
    const receipt = parseResendWebhook({
      type: 'email.bounced',
      created_at: '2026-08-02T10:00:00.000Z',
      data: { email_id: 'email_123', bounce: { type: 'Permanent', subType: 'General' } },
    })

    expect(receipt).toMatchObject({ status: 'bounced', suppressionReason: 'bounce', errorCode: 'General' })
  })

  it('traduz email.complained como failed com supressão de complaint', () => {
    const receipt = parseResendWebhook({
      type: 'email.complained',
      created_at: '2026-08-02T10:00:00.000Z',
      data: { email_id: 'email_123' },
    })

    expect(receipt).toMatchObject({ status: 'failed', suppressionReason: 'complaint' })
  })

  it('ignora eventos que não mudam o estado de uma entrega', () => {
    expect(
      parseResendWebhook({ type: 'email.opened', created_at: '2026-08-02T10:00:00.000Z', data: { email_id: 'x' } }),
    ).toBeUndefined()
  })

  it('ignora payload malformado', () => {
    expect(parseResendWebhook({ not: 'a webhook' })).toBeUndefined()
    expect(parseResendWebhook(null)).toBeUndefined()
    expect(parseResendWebhook('string')).toBeUndefined()
  })
})
