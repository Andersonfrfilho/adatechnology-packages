import { describe, expect, it } from 'bun:test'

import {
  applySendResults,
  attachmentKey,
  canAddAttachments,
  orderOutgoingItems,
  queuedAttachmentsFromQuickReply,
  resolveMaxAttachmentSizeBytes,
  sendQueuedMessage,
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

describe('sendQueuedMessage', () => {
  it('manda texto, depois guardados, depois locais, e esvazia a fila quando tudo sai', async () => {
    const order: string[] = []
    const result = await sendQueuedMessage({
      text: 'oi',
      queue: [LOCAL, FIRST, SECOND],
      idempotencyKey: 'k1',
      sendText: async (text) => {
        order.push(`text:${text}`)
        return true
      },
      sendStoredAttachments: async ({ uploadIds, idempotencyKey }) => {
        order.push(`stored:${uploadIds.join(',')}:${idempotencyKey}`)
        return { results: uploadIds.map((uploadId) => ({ uploadId, status: 'sent' as const })) }
      },
      sendLocalAttachments: async (files) => {
        order.push(`local:${files.map((file) => file.name).join(',')}`)
      },
    })
    expect(order).toEqual(['text:oi', 'stored:a,b:k1', 'local:local.pdf'])
    expect(result.textSent).toBe(true)
    expect(result.remainingQueue).toEqual([])
  })

  it('não manda anexo nenhum quando o texto falha (QR-43)', async () => {
    let storedCalled = false
    let localCalled = false
    const result = await sendQueuedMessage({
      text: 'oi',
      queue: [FIRST, LOCAL],
      idempotencyKey: 'k1',
      sendText: async () => false,
      sendStoredAttachments: async () => {
        storedCalled = true
        return { results: [] }
      },
      sendLocalAttachments: async () => {
        localCalled = true
      },
    })
    expect(storedCalled).toBe(false)
    expect(localCalled).toBe(false)
    expect(result.textSent).toBe(false)
    expect(result.remainingQueue).toEqual([FIRST, LOCAL])
  })

  it('mantém na fila só o que falhou ou não tem porta (QR-37)', async () => {
    const result = await sendQueuedMessage({
      text: '',
      queue: [FIRST, SECOND, LOCAL],
      idempotencyKey: 'k1',
      sendText: async () => true,
      sendStoredAttachments: async () => ({
        results: [
          { uploadId: 'a', status: 'sent' },
          { uploadId: 'b', status: 'failed', errorCode: 'X' },
        ],
      }),
    })
    // sem sendLocalAttachments, o item local não sai e continua na fila
    expect(result.remainingQueue).toEqual([SECOND, LOCAL])
  })

  it('reusa a mesma chave de idempotência ao reenviar o que sobrou', async () => {
    const keys: string[] = []
    await sendQueuedMessage({
      text: '',
      queue: [FIRST],
      idempotencyKey: 'retry-key',
      sendText: async () => true,
      sendStoredAttachments: async ({ idempotencyKey }) => {
        keys.push(idempotencyKey)
        return { results: [{ uploadId: 'a', status: 'failed' as const }] }
      },
    })
    await sendQueuedMessage({
      text: '',
      queue: [FIRST],
      idempotencyKey: 'retry-key',
      sendText: async () => true,
      sendStoredAttachments: async ({ idempotencyKey }) => {
        keys.push(idempotencyKey)
        return { results: [{ uploadId: 'a', status: 'sent' as const }] }
      },
    })
    expect(keys).toEqual(['retry-key', 'retry-key'])
  })
})

describe('queuedAttachmentsFromQuickReply', () => {
  const quickReplyWithAttachments = {
    attachments: [
      { uploadId: 'a', filename: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 1 },
      { uploadId: 'b', filename: 'b.png', mimeType: 'image/png', sizeBytes: 2 },
    ],
  }

  it('empurra os anexos como itens guardados quando o host sabe mandar (QR-32)', () => {
    expect(queuedAttachmentsFromQuickReply(quickReplyWithAttachments, true)).toEqual([
      { kind: 'stored', uploadId: 'a', filename: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 1 },
      { kind: 'stored', uploadId: 'b', filename: 'b.png', mimeType: 'image/png', sizeBytes: 2 },
    ])
  })

  it('não empurra nada sem a porta (QR-33)', () => {
    expect(queuedAttachmentsFromQuickReply(quickReplyWithAttachments, false)).toEqual([])
  })

  it('não empurra nada quando a mensagem não tem anexo', () => {
    expect(queuedAttachmentsFromQuickReply({ attachments: [] }, true)).toEqual([])
    expect(queuedAttachmentsFromQuickReply({ attachments: undefined }, true)).toEqual([])
  })
})

describe('attachmentKey', () => {
  it('usa o uploadId para guardado e a identidade do arquivo para local', () => {
    expect(attachmentKey(FIRST)).toBe('a')
    expect(attachmentKey(LOCAL)).toBe(`local:local.pdf:1:${LOCAL.kind === 'local' ? LOCAL.file.lastModified : ''}`)
  })
})
