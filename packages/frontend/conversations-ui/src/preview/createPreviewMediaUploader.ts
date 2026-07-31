/**
 * Entrega ao simulador o `uploadMedia` que ele precisa para desenhar o microfone.
 *
 * O `ConversationPreview` esconde o gravador sem esta função, e com razão: microfone que grava sem
 * ter onde guardar o arquivo faz o operador falar para o vazio. O que faltava era montar isto —
 * lê o `File`, manda para a rota do host, devolve o `mediaId` prefixado que o webhook referencia.
 *
 * Fica no pacote porque a parte que erra é sempre a mesma em todo produto: converter o binário sem
 * estourar a pilha e marcar o id com o prefixo que o backend reconhece. O que muda por produto é só
 * a rota e o cliente HTTP — e é exatamente isso que entra por parâmetro.
 */

/**
 * Do `contracts`, que este pacote já consome — não uma cópia.
 *
 * A convenção tem duas pontas (o front gera o id, o backend resolve) e a versão anterior disso vivia
 * duplicada em dois pacotes de um produto, cada cópia com um comentário pedindo para não divergir.
 * Contrato compartilhado é o que o `contracts` existe para guardar.
 */
export { PREVIEW_MEDIA_ID_PREFIX } from '@adatechnology/meta-whatsapp-contracts'
import { toPreviewMediaId } from '@adatechnology/meta-whatsapp-contracts'

export type PreviewUploadedMedia = {
  readonly mediaId: string
  readonly mimeType?: string
  readonly filename?: string
}

export type PreviewMediaUploadRequest = {
  readonly base64: string
  readonly mimeType: string
  readonly filename: string
}

export type CreatePreviewMediaUploaderParams = {
  /**
   * Envia o arquivo à rota do host e devolve o `uploadId` (sem prefixo) que o backend gerou.
   *
   * Recebe a função inteira, e não uma URL, porque autenticação varia: uma instalação assina com
   * HMAC, outra manda token de admin, outra usa cookie de sessão. Pedir a URL obrigaria o pacote a
   * escolher por elas.
   */
  readonly upload: (request: PreviewMediaUploadRequest) => Promise<{ uploadId: string }>
  /** Nome usado quando o gravador entrega o áudio sem nome próprio. */
  readonly fallbackFilename?: string
  readonly fallbackMimeType?: string
}

/**
 * Converte em blocos, não com `String.fromCharCode(...bytes)` de uma vez.
 *
 * Espalhar centenas de milhares de bytes como argumentos estoura o limite da engine — poucos segundos
 * de áudio já chegam perto. O sintoma seria `RangeError` só nos arquivos grandes: passa no teste com
 * um clipe curto e falha na primeira gravação de verdade.
 */
const CHUNK_SIZE = 8192

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_SIZE))
  }
  return btoa(binary)
}

export function createPreviewMediaUploader(
  params: CreatePreviewMediaUploaderParams,
): (file: File) => Promise<PreviewUploadedMedia> {
  const fallbackMimeType = params.fallbackMimeType ?? 'audio/ogg'
  const fallbackFilename = params.fallbackFilename ?? 'audio.ogg'

  return async function uploadPreviewMedia(file: File): Promise<PreviewUploadedMedia> {
    // Gravação de voz chega sem nome, e sem mime em navegador antigo.
    const mimeType = file.type || fallbackMimeType
    const filename = file.name || fallbackFilename

    const { uploadId } = await params.upload({ base64: await fileToBase64(file), mimeType, filename })

    return { mediaId: toPreviewMediaId(uploadId), mimeType, filename }
  }
}
