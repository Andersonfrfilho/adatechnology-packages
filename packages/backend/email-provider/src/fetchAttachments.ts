/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Baixa os anexos no momento do envio.
 *
 * O contrato trafega REFERENCIA (`emailAttachment.ts` do contracts): o arquivo vive no storage e a
 * URL assinada chega aqui. Quem baixa e o driver, e nao o modulo, porque o modulo pode decidir nao
 * enviar — supressao, canal desligado, preferencia — e ter carregado 25MB para descobrir isso e
 * desperdicio de memoria num processo que atende outras entregas ao mesmo tempo.
 */

import {
  EMAIL_ATTACHMENT_MAX_BYTES,
  EMAIL_ATTACHMENT_MAX_COUNT,
  checkEmailAttachment,
} from '@adatechnology/notification-contracts'
import type { EmailAttachment } from '@adatechnology/notification-contracts'

/** O anexo pronto para virar MIME: nome, tipo e os bytes. */
export type FetchedAttachment = {
  readonly filename: string
  readonly contentType: string
  readonly content: Uint8Array
}

/**
 * `Error` e nao `DeliveryAttemptResult`: quem chama e o `send` de cada driver, que ja sabe traduzir
 * falha em resultado de tentativa — e cada um classifica diferente.
 */
export class AttachmentFetchError extends Error {
  constructor(readonly errorCode: string) {
    super(`attachment: ${errorCode}`)
    this.name = 'AttachmentFetchError'
  }
}

export async function fetchAttachments(
  attachments: readonly EmailAttachment[] | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<readonly FetchedAttachment[]> {
  if (!attachments || attachments.length === 0) return []

  if (attachments.length > EMAIL_ATTACHMENT_MAX_COUNT) {
    throw new AttachmentFetchError('attachment_count_exceeded')
  }

  // Em paralelo: sao arquivos independentes, e em serie o envio esperaria a soma dos downloads.
  const fetched = await Promise.all(attachments.map((attachment) => fetchOne(attachment, fetchImpl)))

  /**
   * O teto tambem vale para a SOMA. Dez anexos de 20MB passam um a um e produzem uma mensagem de
   * 200MB que nenhum provedor aceita — e o erro voltaria do provedor como falha generica de envio.
   */
  const total = fetched.reduce((sum, attachment) => sum + attachment.content.byteLength, 0)
  if (total > EMAIL_ATTACHMENT_MAX_BYTES) throw new AttachmentFetchError('attachment_total_too_large')

  return fetched
}

async function fetchOne(attachment: EmailAttachment, fetchImpl: typeof fetch): Promise<FetchedAttachment> {
  // Antes de qualquer rede: nome com caminho, tipo vazio e URL fora de https nao viram requisicao.
  const problem = checkEmailAttachment(attachment)
  if (problem) throw new AttachmentFetchError(problem.toLowerCase())

  const response = await fetchImpl(attachment.url).catch(() => undefined)
  if (!response) throw new AttachmentFetchError('attachment_unreachable')
  if (!response.ok) throw new AttachmentFetchError(`attachment_http_${response.status}`)

  /**
   * O `content-length` e conferido ANTES de ler o corpo: sem isso, um objeto trocado no storage
   * entre a assinatura e o envio derrubaria o processo por memoria em vez de reprovar a entrega.
   * Ele e dica, nao garantia — por isso o tamanho real e conferido de novo depois.
   */
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > EMAIL_ATTACHMENT_MAX_BYTES) {
    throw new AttachmentFetchError('attachment_too_large')
  }

  const content = new Uint8Array(await response.arrayBuffer())
  if (content.byteLength > EMAIL_ATTACHMENT_MAX_BYTES) throw new AttachmentFetchError('attachment_too_large')
  if (content.byteLength === 0) throw new AttachmentFetchError('attachment_empty')

  return { filename: attachment.filename, contentType: attachment.contentType, content }
}
