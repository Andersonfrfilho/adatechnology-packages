/**
 * Como o preview entrega mídia para a UI abrir.
 *
 * Separado de `previewFileSamples` (que é gerado) porque aqui está a parte que depende do navegador:
 * **blob URL, não data URL**. O Chrome bloqueia navegação de topo para `data:` desde a v60, então
 * `window.open(dataUrl)` — que é o que os botões "visualizar" e "baixar" fazem — abre aba em branco
 * mesmo com bytes perfeitamente válidos. Em `src` de `<img>`/`<video>` a data URL funcionaria; no
 * `window.open` não, e o mesmo `getDocumentUrl` alimenta os dois.
 */

import type { MessagePayload } from '../types'
import type { ResolveMediaUrl } from '../MediaRenderer'
import { resolvePreviewFileSample } from './previewFileSamples'
import { PREVIEW_DOCUMENTS } from './previewFixtures'

// Uma blob URL por tipo, reaproveitada: cada `createObjectURL` retém o blob até um `revokeObjectURL`
// que ninguém chamaria, e a lista redesenha a cada filtro digitado.
const blobUrlCache = new Map<string, string>()

function toBlob(dataUrl: string): Blob {
  const [head, payload] = dataUrl.split(',')
  const mimeType = head!
    .replace(/^data:/, '')
    .replace(/;base64$/, '')
    .replace(/;charset=.*$/, '')

  if (!head!.endsWith(';base64')) {
    return new Blob([decodeURIComponent(payload!)], { type: mimeType || 'text/plain' })
  }

  const binary = atob(payload!)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mimeType })
}

/** URL que o preview pode abrir em aba nova. Cai na data URL fora do navegador (teste, SSR). */
export function previewFileUrl(mimeType: string | undefined, filename?: string): string {
  const dataUrl = resolvePreviewFileSample(mimeType, filename)
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return dataUrl

  const cached = blobUrlCache.get(dataUrl)
  if (cached) return cached

  const blobUrl = URL.createObjectURL(toBlob(dataUrl))
  blobUrlCache.set(dataUrl, blobUrl)
  return blobUrl
}

/**
 * A mesma amostra em base64 cru, como o proxy de mídia do backend a devolveria.
 *
 * Existe porque `getMediaProxyUrl` é o caminho da mídia AINDA NÃO ingerida (só existe o id na Meta),
 * e o contrato pede `{ mimeType, data }` — não URL. Sem isto o mock devolvia o PNG 1x1 para
 * qualquer id, e vídeo e áudio da thread apareciam quebrados apesar de haver amostra válida.
 */
export function previewFileBase64(mimeType: string | undefined, filename?: string): { mimeType: string; data: string } {
  const dataUrl = resolvePreviewFileSample(mimeType, filename)
  const [head, payload] = dataUrl.split(',')
  const declared = head!
    .replace(/^data:/, '')
    .replace(/;base64$/, '')
    .replace(/;charset=.*$/, '')

  if (head!.endsWith(';base64')) return { mimeType: declared, data: payload! }
  return { mimeType: declared, data: btoa(decodeURIComponent(payload!)) }
}

/**
 * O `onResolveMediaUrl` que o `MessageBubble` espera.
 *
 * Sem ele, foto, vídeo e áudio da thread ficam parados no placeholder para sempre — o
 * `MediaRenderer` só resolve `uploadId`/`mediaId` por esta porta, de propósito, para o pacote nunca
 * chamar endpoint fixo. O preview não tinha resolvedor nenhum, então nenhuma mídia carregava.
 */
export function createPreviewMediaResolver(): ResolveMediaUrl {
  const byId = new Map<string, { mimeType: string; filename: string }>()
  for (const documents of Object.values(PREVIEW_DOCUMENTS)) {
    for (const document of documents) {
      byId.set(document.id, { mimeType: document.mimeType, filename: document.filename })
    }
  }

  return async (message: MessagePayload): Promise<string | null> => {
    const reference = message.uploadId ?? (message.mediaId ? `preview/inbound/${message.mediaId}` : undefined)
    if (!reference) return null

    const known = byId.get(reference)
    return previewFileUrl(known?.mimeType ?? message.mimeType, known?.filename ?? message.filename)
  }
}
