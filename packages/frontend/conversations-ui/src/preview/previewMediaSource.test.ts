/**
 * Guarda o resolvedor de mídia do preview.
 *
 * As asserções comparam com `previewFileUrl(tipo)` em vez de com a data URL da amostra: o bun também
 * tem `URL.createObjectURL`, então o retorno é `blob:` aqui como no navegador, e blob URL não expõe
 * o conteúdo para comparar. O que este teste trava é o MAPEAMENTO — mensagem → amostra do tipo certo
 * —, enquanto os bytes de cada tipo são conferidos em `previewFileSamples.test.ts`.
 */

import { describe, expect, it } from 'bun:test'

import { createPreviewMediaResolver, previewFileUrl } from './previewMediaSource'
import type { MessagePayload } from '../types'

const resolve = createPreviewMediaResolver()

function message(partial: Partial<MessagePayload>): MessagePayload {
  return {
    id: 'msg-1',
    type: 'image',
    direction: 'inbound',
    sender: 'customer',
    timestamp: '2026-07-26T15:00:00.000Z',
    ...partial,
  } as MessagePayload
}

describe('createPreviewMediaResolver', () => {
  it('resolve mídia pelo mediaId, achando o tipo na biblioteca do fixture', async () => {
    // preview-image-1 é a foto png da thread da Rita.
    expect(await resolve(message({ mediaId: 'preview-image-1' }))).toBe(previewFileUrl('image/png'))
  })

  it('resolve documento pelo uploadId', async () => {
    const resolved = await resolve(message({ type: 'document', uploadId: 'preview/documentos/nota-fiscal.pdf' }))

    expect(resolved).toBe(previewFileUrl('application/pdf'))
  })

  // O sticker é webp e o áudio de voz é opus: dois tipos que o painel antes nem listava.
  it('resolve sticker e áudio', async () => {
    expect(await resolve(message({ mediaId: 'preview-sticker-1' }))).toBe(previewFileUrl('image/webp'))
    expect(await resolve(message({ mediaId: 'preview-audio-2' }))).toBe(previewFileUrl('audio/ogg'))
  })

  // Mídia que não está na biblioteca ainda tem de abrir: cai no mimeType da própria mensagem.
  it('usa o mimeType da mensagem quando o id é desconhecido', async () => {
    const resolved = await resolve(message({ mediaId: 'nunca-visto', mimeType: 'image/jpeg' }))

    expect(resolved).toBe(previewFileUrl('image/jpeg'))
  })

  // Sem referência nenhuma o MediaRenderer não deve receber URL — devolver algo aqui faria a bolha
  // mostrar arquivo que a mensagem não tem.
  it('devolve null para mensagem sem uploadId nem mediaId', async () => {
    expect(await resolve(message({ type: 'text' }))).toBeNull()
  })

  it('reaproveita a mesma URL para o mesmo tipo', () => {
    expect(previewFileUrl('application/pdf')).toBe(previewFileUrl('application/pdf'))
  })
})
