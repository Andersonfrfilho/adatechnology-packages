import { describe, expect, it } from 'bun:test'

import {
  applySendResults,
  attachmentKey,
  canAddAttachments,
  excludeRetryingItems,
  hasSentEveryStoredUpload,
  orderOutgoingItems,
  queuedAttachmentsFromQuickReply,
  resolveIdempotencyKey,
  resolveMaxAttachmentSizeBytes,
  resolveRetryOutcome,
  retryStoredAttachments,
  sendQueuedMessage,
} from './quickReplyAttachments'
import type { QueuedAttachment } from './quickReply.types'

const LOCAL: QueuedAttachment = {
  kind: 'local',
  localId: 'local-1',
  file: new File(['x'], 'local.pdf', { type: 'application/pdf' }),
}
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

describe('onAttachmentStatus: pulado distinto de falhou', () => {
  it('sendQueuedMessage reporta skipped, não failed, para um item pulado no lote', async () => {
    const statuses: { key: string; status: string }[] = []
    await sendQueuedMessage({
      text: '',
      queue: [FIRST, SECOND],
      idempotencyKey: 'k1',
      sendText: async () => true,
      sendStoredAttachments: async () => ({
        results: [
          { uploadId: 'a', status: 'failed', errorCode: 'UPLOAD_FAILED' },
          { uploadId: 'b', status: 'skipped' },
        ],
      }),
      onAttachmentStatus: (key, status) => statuses.push({ key, status }),
    })
    expect(statuses).toContainEqual({ key: 'a', status: 'failed' })
    expect(statuses).toContainEqual({ key: 'b', status: 'skipped' })
  })

  it('retryStoredAttachments reporta skipped, não failed, para o item pulado', async () => {
    const statuses: { key: string; status: string }[] = []
    await retryStoredAttachments({
      queue: [FIRST],
      uploadIds: ['a'],
      idempotencyKey: 'k',
      sendStoredAttachments: async () => ({ results: [{ uploadId: 'a', status: 'skipped' }] }),
      onAttachmentStatus: (key, status) => statuses.push({ key, status }),
    })
    expect(statuses).toEqual([
      { key: 'a', status: 'sending' },
      { key: 'a', status: 'skipped' },
    ])
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
    // sentAttachmentKeys deixa o chamador remover por chave de um estado corrente em vez de
    // sobrescrever com remainingQueue (calculado sobre a fila capturada antes do await) — o item
    // adicionado durante o envio (MEDIUM 1) não pode se perder nessa troca.
    expect([...result.sentAttachmentKeys].sort()).toEqual(['a', 'b', 'local-1'])
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

  it('marca todo guardado como falha quando o lote lança (H3)', async () => {
    const result = await sendQueuedMessage({
      text: '',
      queue: [FIRST, SECOND],
      idempotencyKey: 'k1',
      sendText: async () => true,
      sendStoredAttachments: async () => {
        throw new Error('rede caiu')
      },
    })
    expect(result.textSent).toBe(true)
    expect(result.remainingQueue).toEqual([FIRST, SECOND])
  })

  it('trata guardado ausente do resultado do lote como falha (M5)', async () => {
    const result = await sendQueuedMessage({
      text: '',
      queue: [FIRST, SECOND],
      idempotencyKey: 'k1',
      sendText: async () => true,
      sendStoredAttachments: async () => ({ results: [{ uploadId: 'a', status: 'sent' as const }] }),
    })
    expect(result.remainingQueue).toEqual([SECOND])
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

describe('resolveIdempotencyKey', () => {
  it('gera chave nova sem estado anterior', () => {
    const state = resolveIdempotencyKey(undefined, ['a', 'b'], () => 'new-key')
    expect(state).toEqual({ key: 'new-key', uploadIds: ['a', 'b'] })
  })

  it('reusa a chave quando o conjunto ordenado de uploadIds não muda', () => {
    const previous = { key: 'k1', uploadIds: ['a', 'b'] }
    const state = resolveIdempotencyKey(previous, ['a', 'b'], () => 'should-not-be-used')
    expect(state).toBe(previous)
  })

  it('gera chave nova quando um uploadId entra ou sai', () => {
    const previous = { key: 'k1', uploadIds: ['a', 'b'] }
    expect(resolveIdempotencyKey(previous, ['a'], () => 'k2')).toEqual({ key: 'k2', uploadIds: ['a'] })
    expect(resolveIdempotencyKey(previous, ['a', 'b', 'c'], () => 'k3')).toEqual({
      key: 'k3',
      uploadIds: ['a', 'b', 'c'],
    })
  })

  it('gera chave nova quando a ordem muda, mesmo com o mesmo conjunto', () => {
    const previous = { key: 'k1', uploadIds: ['a', 'b'] }
    expect(resolveIdempotencyKey(previous, ['b', 'a'], () => 'k2')).toEqual({ key: 'k2', uploadIds: ['b', 'a'] })
  })
})

describe('hasSentEveryStoredUpload', () => {
  it('true quando não havia guardado nenhum nesta tentativa', () => {
    expect(hasSentEveryStoredUpload([], [])).toBe(true)
    expect(hasSentEveryStoredUpload([], ['a'])).toBe(true)
  })

  it('true quando todo uploadId da tentativa saiu', () => {
    expect(hasSentEveryStoredUpload(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(hasSentEveryStoredUpload(['a', 'b'], ['b', 'a'])).toBe(true)
  })

  it('true mesmo com chave extra em sentAttachmentKeys (ex: anexo local também enviado)', () => {
    expect(hasSentEveryStoredUpload(['a'], ['a', 'local-1'])).toBe(true)
  })

  it('falso quando um uploadId falhou ou foi pulado', () => {
    expect(hasSentEveryStoredUpload(['a', 'b'], ['a'])).toBe(false)
  })

  it('falso quando nada saiu', () => {
    expect(hasSentEveryStoredUpload(['a', 'b'], [])).toBe(false)
  })
})

describe('retryStoredAttachments', () => {
  it('reenvia só o uploadId pedido, sem tocar no resto da fila', async () => {
    const calls: { uploadIds: readonly string[]; idempotencyKey: string }[] = []
    const result = await retryStoredAttachments({
      queue: [FIRST, SECOND, LOCAL],
      uploadIds: ['b'],
      idempotencyKey: 'retry-b',
      sendStoredAttachments: async ({ uploadIds, idempotencyKey }) => {
        calls.push({ uploadIds, idempotencyKey })
        return { results: [{ uploadId: 'b', status: 'sent' as const }] }
      },
    })
    expect(calls).toEqual([{ uploadIds: ['b'], idempotencyKey: 'retry-b' }])
    expect(result.remainingQueue).toEqual([FIRST, LOCAL])
    expect(result.sentAttachmentKeys).toEqual(['b'])
  })

  it('sentAttachmentKeys vem vazio quando o reenvio falha (nada para remover por chave)', async () => {
    const result = await retryStoredAttachments({
      queue: [FIRST],
      uploadIds: ['a'],
      idempotencyKey: 'k',
      sendStoredAttachments: async () => ({ results: [{ uploadId: 'a', status: 'failed' as const }] }),
    })
    expect(result.sentAttachmentKeys).toEqual([])
  })

  it('sem item correspondente na fila, não chama a porta e devolve a fila intacta', async () => {
    let called = false
    const result = await retryStoredAttachments({
      queue: [FIRST],
      uploadIds: ['nao-existe'],
      idempotencyKey: 'k',
      sendStoredAttachments: async () => {
        called = true
        return { results: [] }
      },
    })
    expect(called).toBe(false)
    expect(result.remainingQueue).toEqual([FIRST])
  })

  it('mantém o item na fila quando o reenvio falha', async () => {
    const result = await retryStoredAttachments({
      queue: [FIRST],
      uploadIds: ['a'],
      idempotencyKey: 'k',
      sendStoredAttachments: async () => {
        throw new Error('rede caiu')
      },
    })
    expect(result.remainingQueue).toEqual([FIRST])
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
  it('usa o uploadId para guardado e o localId para local', () => {
    expect(attachmentKey(FIRST)).toBe('a')
    expect(attachmentKey(LOCAL)).toBe('local-1')
  })

  it('distingue duas cópias do mesmo arquivo local pelo localId gerado, não pela identidade do File', () => {
    const file = new File(['x'], 'same.pdf', { type: 'application/pdf' })
    const first: QueuedAttachment = { kind: 'local', localId: 'local-a', file }
    const second: QueuedAttachment = { kind: 'local', localId: 'local-b', file }
    expect(attachmentKey(first)).not.toBe(attachmentKey(second))
  })
})

describe('resolveRetryOutcome', () => {
  it('conversa diferente da do retry devolve undefined, deixando a fila corrente intocada', () => {
    const outcome = resolveRetryOutcome({
      conversationIdAtRetry: 'conversation-1',
      currentConversationId: 'conversation-2',
      sentAttachmentKeys: ['a'],
      queue: [],
    })
    expect(outcome).toBeUndefined()
  })

  it('mesma conversa: tira só as chaves enviadas e mantém item adicionado durante o retry', () => {
    const addedMidRetry: QueuedAttachment = {
      kind: 'stored',
      uploadId: 'c',
      filename: 'c.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1,
    }
    const outcome = resolveRetryOutcome({
      conversationIdAtRetry: 'conversation-1',
      currentConversationId: 'conversation-1',
      sentAttachmentKeys: ['a'],
      queue: [FIRST, SECOND, addedMidRetry],
    })
    expect(outcome).toEqual([SECOND, addedMidRetry])
  })
})

describe('excludeRetryingItems', () => {
  it('sem chaves em retry devolve a fila como veio', () => {
    expect(excludeRetryingItems([FIRST, LOCAL], new Set())).toEqual([FIRST, LOCAL])
  })

  it('tira só os itens cuja chave está em retry avulso', () => {
    const result = excludeRetryingItems([FIRST, SECOND, LOCAL], new Set(['b']))
    expect(result).toEqual([FIRST, LOCAL])
  })
})
