import { describe, expect, it } from 'bun:test'
import { buildInboundMediaPayload } from './inboundPayloads'

const envelope = { from: '5511999888777' }

function messageOf(payload: ReturnType<typeof buildInboundMediaPayload>) {
  return payload.entry[0].changes[0].value.messages![0] as Record<string, any>
}

describe('buildInboundMediaPayload', () => {
  it('põe o bloco com o nome do próprio tipo, como a Meta faz', () => {
    const message = messageOf(
      buildInboundMediaPayload({ ...envelope, mediaType: 'image', mediaId: 'media-1', mimeType: 'image/png' }),
    )

    expect(message.type).toBe('image')
    expect(message.image).toEqual({ id: 'media-1', mime_type: 'image/png' })
  })

  it('carrega filename e caption em documento', () => {
    const message = messageOf(
      buildInboundMediaPayload({
        ...envelope,
        mediaType: 'document',
        mediaId: 'media-2',
        mimeType: 'application/pdf',
        filename: 'contrato.pdf',
        caption: 'segue o contrato',
      }),
    )

    expect(message.document).toEqual({
      id: 'media-2',
      mime_type: 'application/pdf',
      filename: 'contrato.pdf',
      caption: 'segue o contrato',
    })
  })

  it('omite campos vazios em vez de emitir chave nula que a Meta nunca manda', () => {
    const message = messageOf(buildInboundMediaPayload({ ...envelope, mediaType: 'audio', mediaId: 'media-3' }))

    expect(Object.keys(message.audio)).toEqual(['id'])
  })
})
