/**
 * Resolve a mídia de uma mensagem numa URL exibível, usando só o `ConversationsApi`.
 *
 * Mora no pacote, e não em cada host, porque a regra não tem nada de específico de produto: é a
 * tradução de `uploadId`/`mediaId` pelos dois métodos que o próprio contrato já declara. Deixá-la no
 * host significava que todo projeto que adotasse o SDK reescreveria as mesmas oito linhas — e, na
 * prática, ninguém escrevia: o `MediaRenderer` só busca mídia pela porta `onResolveMediaUrl`, então
 * onde nada era injetado foto, vídeo e áudio ficavam no placeholder para sempre.
 */

import type { MessagePayload } from '../types'
import type { ConversationsApi } from '../providers/types'
import type { ResolveMediaUrl } from '../MediaRenderer'

export function createMediaUrlResolver(
  api: Pick<ConversationsApi, 'getDocumentUrl' | 'getMediaProxyUrl'>,
): ResolveMediaUrl {
  return async (message: MessagePayload): Promise<string | null> => {
    // Mídia já copiada para o storage do host: sai por URL assinada e o binário não passa pela API.
    // `inline` porque aqui o arquivo é para VER na tela — `attachment` faria o navegador baixar.
    if (message.uploadId) return api.getDocumentUrl(message.uploadId, 'inline')

    // Antes da ingestão só existe o id na Meta, cuja URL expira; o backend busca e devolve base64.
    // Data URL serve de `src` para `<img>`/`<video>`/`<audio>`: o bloqueio do Chrome a `data:` vale
    // para navegação de topo, não para carregar mídia dentro da página.
    if (message.mediaId) {
      const { mimeType, data } = await api.getMediaProxyUrl(message.mediaId)
      return `data:${mimeType};base64,${data}`
    }

    return null
  }
}
