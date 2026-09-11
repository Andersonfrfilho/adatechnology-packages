import { describe, expect, it } from 'bun:test'

import {
  applySendResults,
  canAddAttachments,
  orderOutgoingItems,
  resolveMaxAttachmentSizeBytes,
} from './quickReplyAttachments'
import type { QueuedAttachment } from './quickReply.types'

const LOCAL: QueuedAttachment = { kind: 'local', file: new File(['x'], 'local.pdf', { type: 'application/pdf' }) }
const FIRST: QueuedAttachment = {
  kind: 'stored',
  uploadId: 'a',
  filename: 'a.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1,
}
const SECOND: QueuedAttachment = {
  kind: 'stored',
  uploadId: 'b',
  filename: 'b.png',
  mimeType: 'image/png',
  sizeBytes: 1,
}

describe('orderOutgoingItems', () => {
  it('põe guardados na ordem do cadastro antes dos locais', () => {
    const items = orderOutgoingItems('oi', [LOCAL, FIRST, SECOND])
    expect(items.text).toBe('oi')
    expect(items.attachments).toEqual([FIRST, SECOND, LOCAL])
  })
})

describe('applySendResults', () => {
  it('mantém só o que não foi enviado', () => {
    const queue = applySendResults(
      [FIRST, SECOND, LOCAL],
      [
        { uploadId: 'a', status: 'sent' },
        { uploadId: 'b', status: 'failed', errorCode: 'X' },
      ],
    )
    expect(queue).toEqual([SECOND, LOCAL])
  })

  it('mantém o pulado', () => {
    expect(applySendResults([FIRST], [{ uploadId: 'a', status: 'skipped' }])).toEqual([FIRST])
  })
})

describe('canAddAttachments', () => {
  it('aceita até o teto e recusa acima', () => {
    expect(canAddAttachments(8, 2)).toBe(true)
    expect(canAddAttachments(9, 2)).toBe(false)
  })
})

describe('resolveMaxAttachmentSizeBytes', () => {
  it('usa o teto por tipo', () => {
    expect(resolveMaxAttachmentSizeBytes('image/png')).toBe(5 * 1024 * 1024)
    expect(resolveMaxAttachmentSizeBytes('audio/ogg')).toBe(16 * 1024 * 1024)
    expect(resolveMaxAttachmentSizeBytes('video/mp4')).toBe(16 * 1024 * 1024)
    expect(resolveMaxAttachmentSizeBytes('application/pdf')).toBe(100 * 1024 * 1024)
  })

  it('aceita limites do host', () => {
    expect(resolveMaxAttachmentSizeBytes('image/png', { document: 1, image: 2, audio: 3, video: 4 })).toBe(2)
  })
})
