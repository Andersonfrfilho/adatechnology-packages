/**
 * O teste que importa aqui é o do prefixo: ele é duplicado entre este pacote (UI) e o
 * meta-whatsapp-module (backend), e divergir significa o simulador gerar um id que o servidor não
 * reconhece — o áudio chega, o backend busca na Meta, volta 404 e ninguém entende por quê.
 */

import { describe, expect, it } from 'bun:test'
import { PREVIEW_MEDIA_ID_PREFIX as CONTRACT_PREFIX } from '@adatechnology/meta-whatsapp-contracts'

import { createPreviewMediaUploader, PREVIEW_MEDIA_ID_PREFIX } from './createPreviewMediaUploader'

describe('createPreviewMediaUploader', () => {
  it('reexporta o prefixo do contrato, sem cópia própria', () => {
    expect(PREVIEW_MEDIA_ID_PREFIX).toBe(CONTRACT_PREFIX)
  })

  it('devolve o id prefixado com o uploadId da rota', async () => {
    const upload = createPreviewMediaUploader({ upload: async () => ({ uploadId: 'chave/do/objeto' }) })

    const result = await upload(new File([new Uint8Array([1, 2, 3])], 'nota.ogg', { type: 'audio/ogg' }))

    expect(result.mediaId).toBe(`${CONTRACT_PREFIX}chave/do/objeto`)
    expect(result.mimeType).toBe('audio/ogg')
    expect(result.filename).toBe('nota.ogg')
  })

  it('manda o binário em base64 para a rota', async () => {
    let recebido: string | undefined
    const upload = createPreviewMediaUploader({
      upload: async (request) => {
        recebido = request.base64
        return { uploadId: 'k' }
      },
    })

    await upload(new File([new TextEncoder().encode('audio')], 'a.ogg', { type: 'audio/ogg' }))

    expect(atob(recebido!)).toBe('audio')
  })

  // Gravador entrega áudio sem nome, e navegador antigo entrega sem mime.
  it('preenche nome e mime quando o arquivo vem sem eles', async () => {
    const upload = createPreviewMediaUploader({ upload: async () => ({ uploadId: 'k' }) })

    const result = await upload(new File([new Uint8Array([1])], '', { type: '' }))

    expect(result.mimeType).toBe('audio/ogg')
    expect(result.filename).toBe('audio.ogg')
  })

  /**
   * Espalhar o array de bytes como argumentos estoura a pilha em arquivo grande — o erro que só
   * aparece na primeira gravação de verdade, nunca no clipe curto do teste.
   */
  it('converte arquivo grande sem estourar a pilha', async () => {
    const upload = createPreviewMediaUploader({ upload: async () => ({ uploadId: 'k' }) })
    const grande = new File([new Uint8Array(300_000)], 'longo.ogg', { type: 'audio/ogg' })

    expect((await upload(grande)).mediaId).toContain(CONTRACT_PREFIX)
  })
})
