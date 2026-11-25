/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { buildPreviewInboundPayload } from './previewCommand'

describe('buildPreviewInboundPayload', () => {
  it('stamps the host phone number id so the webhook number filter accepts it', () => {
    const payload = buildPreviewInboundPayload(
      { kind: 'listReply', from: '05500000000000', reply: { id: 'book', title: 'Agendar' } },
      { phoneNumberId: '123456789012345' },
    )
    const value = payload.entry[0]!.changes[0]!.value
    expect(value.metadata?.phone_number_id).toBe('123456789012345')
    expect(value.messages?.[0]?.interactive?.list_reply?.id).toBe('book')
    expect(value.messages?.[0]?.from).toBe('05500000000000')
  })

  it('builds media commands without leaking command fields', () => {
    const payload = buildPreviewInboundPayload(
      { kind: 'media', from: '0551', mediaType: 'document', mediaId: 'preview-upload:x', filename: 'a.pdf' },
      { phoneNumberId: '1' },
    )
    const message = payload.entry[0]!.changes[0]!.value.messages?.[0]
    expect(message?.type).toBe('document')
    expect(message).not.toHaveProperty('kind')
  })
})
