/**
 * Mídia que veio do simulador de conversa, não da Meta.
 *
 * Vive no `contracts` porque é literalmente um contrato entre as duas pontas: o front gera o id, o
 * backend o resolve. Nasceu duplicado num produto (duas constantes iguais, cada uma com um
 * comentário pedindo "precisa bater com a outra") e por isso o segundo produto não herdou nada —
 * este pacote é o único lugar em que os dois lados já se encontram.
 *
 * O simulador manda **webhook**, e webhook da Meta carrega referência de mídia (um id), nunca o
 * binário. Então o arquivo gravado no navegador precisa existir em algum lugar que o servidor
 * alcance, e o id precisa dizer onde — é essa a convenção deste arquivo.
 *
 * Existe no pacote, e não em cada host, porque a convenção tem DOIS lados que precisam concordar
 * (quem gera o id no front, quem o resolve no backend). Onde ela ficou no host, o resultado foi
 * exatamente o previsível: duas constantes iguais em pacotes diferentes, cada uma com um comentário
 * pedindo "precisa bater com a outra" — e o segundo produto não herdou nada e ficou sem o recurso.
 */

/**
 * Prefixo que marca o id como local.
 *
 * Dois-pontos no fim de propósito: id da Meta é alfanumérico com `_` e `-`, então o separador torna
 * a colisão impossível em vez de improvável.
 */
export const PREVIEW_MEDIA_ID_PREFIX = 'preview-upload:'

/** Monta o id que o simulador manda no webhook. */
export function toPreviewMediaId(uploadId: string): string {
  return `${PREVIEW_MEDIA_ID_PREFIX}${uploadId}`
}

/**
 * `uploadId` embutido no id, ou `undefined` quando a mídia veio mesmo da Meta.
 *
 * Devolver `undefined` para id sem prefixo é o que mantém o caminho normal intacto: o adaptador só
 * desvia para o storage quando o prefixo está lá.
 */
export function resolvePreviewUploadId(mediaId: string): string | undefined {
  if (!mediaId.startsWith(PREVIEW_MEDIA_ID_PREFIX)) return undefined
  return mediaId.slice(PREVIEW_MEDIA_ID_PREFIX.length) || undefined
}
