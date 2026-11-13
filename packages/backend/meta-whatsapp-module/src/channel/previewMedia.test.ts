/**
 * A convenção de mídia do simulador e, principalmente, a trava que a mantém desligada.
 *
 * O risco aqui não é funcional, é de segurança: com o desvio ligado, `preview-upload:<chave>` faz o
 * servidor ler um objeto arbitrário do storage. Se a flag deixar de ser respeitada, um webhook
 * forjado ganha leitura do bucket — e nada no comportamento normal denunciaria isso.
 */

import { describe, expect, it } from 'bun:test'

import type { WhatsAppMessageProvider } from '@adatechnology/meta-whatsapp-provider'
import { WhatsAppChannelAdapter, type PreviewMediaSupport } from './WhatsAppChannelAdapter'
import { PREVIEW_MEDIA_ID_PREFIX, resolvePreviewUploadId, toPreviewMediaId } from './previewMedia'

const UPLOAD_KEY = 'meta-whatsapp/empresa/preview/abc123'

function storageServing(bytes: string): PreviewMediaSupport['objectStorage'] {
  return {
    upload: async () => ({ uploadId: UPLOAD_KEY }),
    getDownloadUrl: async () => 'https://example.test/objeto',
    getObject: async () => Buffer.from(bytes),
  }
}

function providerThatShouldNotBeCalled(): { provider: WhatsAppMessageProvider; wasCalled: () => boolean } {
  let called = false
  const provider = {
    fetchMediaAsBase64: async () => {
      called = true
      return { data: '', mimeType: '' }
    },
  } as unknown as WhatsAppMessageProvider

  return { provider, wasCalled: () => called }
}

describe('convenção de id do simulador', () => {
  it('ida e volta do id', () => {
    const mediaId = toPreviewMediaId(UPLOAD_KEY)

    expect(mediaId).toBe(`${PREVIEW_MEDIA_ID_PREFIX}${UPLOAD_KEY}`)
    expect(resolvePreviewUploadId(mediaId)).toBe(UPLOAD_KEY)
  })

  // Id da Meta é alfanumérico com `_` e `-`; o `:` do prefixo torna a colisão impossível.
  it('id da Meta não é confundido com id do simulador', () => {
    for (const metaId of ['1234567890', 'wamid.HBgLNTUx', 'abc_DEF-123']) {
      expect(resolvePreviewUploadId(metaId)).toBeUndefined()
    }
  })

  it('prefixo sem chave não vira upload vazio', () => {
    expect(resolvePreviewUploadId(PREVIEW_MEDIA_ID_PREFIX)).toBeUndefined()
  })
})

describe('WhatsAppChannelAdapter — mídia do simulador', () => {
  it('lê do storage quando o recurso está ligado, sem tocar na Graph API', async () => {
    const { provider, wasCalled } = providerThatShouldNotBeCalled()
    const adapter = new WhatsAppChannelAdapter(provider, {
      isEnabled: true,
      objectStorage: storageServing('bytes-do-audio'),
    })

    const result = await adapter.fetchMediaAsBase64(toPreviewMediaId(UPLOAD_KEY))

    expect(Buffer.from(result.data, 'base64').toString()).toBe('bytes-do-audio')
    expect(result.mimeType).toBe('audio/ogg')
    // Id do simulador não existe na Meta: buscá-lo lá renderia 404 em vez do áudio gravado.
    expect(wasCalled()).toBe(false)
  })

  /**
   * A trava. Desligado, o prefixo não tem poder nenhum — o id vai para a Graph API como qualquer
   * outro e volta 404, que é o comportamento correto para um id que a Meta não conhece.
   */
  it('DESLIGADO, ignora o prefixo e não lê o storage', async () => {
    let storageWasRead = false
    const provider = {
      fetchMediaAsBase64: async () => ({ data: 'da-meta', mimeType: 'audio/ogg' }),
    } as unknown as WhatsAppMessageProvider

    const adapter = new WhatsAppChannelAdapter(provider, {
      isEnabled: false,
      objectStorage: {
        upload: async () => ({ uploadId: UPLOAD_KEY }),
        getDownloadUrl: async () => '',
        getObject: async () => {
          storageWasRead = true
          return Buffer.from('nunca')
        },
      },
    })

    const result = await adapter.fetchMediaAsBase64(toPreviewMediaId(UPLOAD_KEY))

    expect(storageWasRead).toBe(false)
    expect(result.data).toBe('da-meta')
  })

  // Sem o suporte injetado, o adaptador é o de sempre — atualizar o pacote não abre nada.
  it('sem suporte injetado, todo id vai para a Graph API', async () => {
    const provider = {
      fetchMediaAsBase64: async () => ({ data: 'da-meta', mimeType: 'audio/ogg' }),
    } as unknown as WhatsAppMessageProvider
    const adapter = new WhatsAppChannelAdapter(provider)

    const result = await adapter.fetchMediaAsBase64(toPreviewMediaId(UPLOAD_KEY))

    expect(result.data).toBe('da-meta')
  })
})
