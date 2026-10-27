import { describe, expect, it } from 'bun:test'

import { mapWithConcurrencyLimit, moveAttachment, validateAttachmentFiles } from './quickReplyAttachmentUpload'

function file(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

describe('validateAttachmentFiles', () => {
  it('aceita dentro do teto e do tamanho por tipo', () => {
    const result = validateAttachmentFiles([file('a.png', 'image/png', 10)], 0)
    expect(result.accepted.map((f) => f.name)).toEqual(['a.png'])
    expect(result.rejected).toEqual([])
  })

  it('recusa por tamanho sem subir', () => {
    const big = file('big.png', 'image/png', 6 * 1024 * 1024)
    const result = validateAttachmentFiles([big], 0)
    expect(result.accepted).toEqual([])
    expect(result.rejected).toEqual([{ file: big, reason: 'size' }])
  })

  it('recusa a partir do teto de 10, mantendo os anteriores', () => {
    const files = Array.from({ length: 3 }, (_, index) => file(`f${index}.pdf`, 'application/pdf', 10))
    const result = validateAttachmentFiles(files, 9)
    expect(result.accepted.map((f) => f.name)).toEqual(['f0.pdf'])
    expect(result.rejected.map((r) => r.file.name)).toEqual(['f1.pdf', 'f2.pdf'])
    expect(result.rejected.every((r) => r.reason === 'limit')).toBe(true)
  })

  it('aceita limites do host', () => {
    const result = validateAttachmentFiles([file('a.png', 'image/png', 3)], 0, {
      document: 1,
      image: 2,
      audio: 1,
      video: 1,
    })
    expect(result.rejected).toEqual([{ file: expect.anything(), reason: 'size' }])
  })
})

describe('moveAttachment', () => {
  it('move um item para frente e para trás', () => {
    expect(moveAttachment(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveAttachment(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
  })

  it('não faz nada nas bordas', () => {
    expect(moveAttachment(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(moveAttachment(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
})

describe('mapWithConcurrencyLimit', () => {
  it('preserva a ordem do resultado mesmo com término fora de ordem', async () => {
    const order = [30, 10, 20]
    const result = await mapWithConcurrencyLimit(order, 3, async (delay) => {
      await new Promise((resolve) => setTimeout(resolve, delay))
      return delay
    })
    expect(result).toEqual([30, 10, 20])
  })

  it('nunca roda mais que o limite ao mesmo tempo', async () => {
    let current = 0
    let max = 0
    await mapWithConcurrencyLimit([1, 2, 3, 4, 5, 6], 3, async (item) => {
      current += 1
      max = Math.max(max, current)
      await new Promise((resolve) => setTimeout(resolve, 5))
      current -= 1
      return item
    })
    expect(max).toBeLessThanOrEqual(3)
  })
})
