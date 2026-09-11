import { describe, expect, it } from 'bun:test'

import { departedItemsOf } from './QueuedAttachmentsList'
import type { QueuedAttachment } from '../quickReplies/quickReply.types'

function storedItem(uploadId: string): QueuedAttachment {
  return { kind: 'stored', uploadId, filename: `${uploadId}.pdf`, mimeType: 'application/pdf', sizeBytes: 100 }
}

describe('departedItemsOf', () => {
  it('não aponta saída quando a fila não muda', () => {
    const items = [storedItem('a'), storedItem('b')]
    expect(departedItemsOf(items, items)).toEqual([])
  })

  it('aponta só o item que saiu da fila', () => {
    const previouslyRendered = [storedItem('a'), storedItem('b')]
    const items = [storedItem('a')]
    expect(departedItemsOf(previouslyRendered, items)).toEqual([storedItem('b')])
  })

  it('não aponta saída quando um item entra na fila', () => {
    const previouslyRendered = [storedItem('a')]
    const items = [storedItem('a'), storedItem('b')]
    expect(departedItemsOf(previouslyRendered, items)).toEqual([])
  })
})
