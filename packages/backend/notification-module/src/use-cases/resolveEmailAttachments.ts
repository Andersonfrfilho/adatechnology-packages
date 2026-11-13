/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Descobre quais valores do payload são ANEXO, e não texto.
 *
 * O catálogo de variáveis do template é quem decide (`kind: 'attachment'`), e não a forma do valor.
 * Farejar a estrutura — "tem `filename`, `url` e `contentType`, deve ser anexo" — transformaria
 * qualquer objeto que o produto mandasse no payload num anexo por acidente, e o acidente só
 * apareceria na caixa de entrada de quem recebeu.
 *
 * Por isso o `kind` existe no contrato, e por isso ele é lido aqui.
 */

import { TEMPLATE_VARIABLE_KIND } from '@adatechnology/notification-contracts'
import type { EmailAttachment, TemplateVariableDefinition } from '@adatechnology/notification-contracts'

export type ResolveEmailAttachmentsParams = {
  readonly payload: Readonly<Record<string, unknown>>
  /** Ausente significa catálogo não declarado para esta chave — então nada é anexo. */
  readonly variables: readonly TemplateVariableDefinition[] | undefined
}

export function resolveEmailAttachments(params: ResolveEmailAttachmentsParams): readonly EmailAttachment[] {
  if (!params.variables) return []

  const attachments: EmailAttachment[] = []

  for (const variable of params.variables) {
    if (variable.kind !== TEMPLATE_VARIABLE_KIND.ATTACHMENT) continue

    const value = params.payload[variable.name]
    const attachment = toAttachment(value)

    /**
     * Anexo declarado e ausente do payload é silêncio, não erro.
     *
     * O mesmo template serve o disparo que leva a nota e o que não leva, e derrubar a entrega por
     * um anexo opcional trocaria "e-mail sem PDF" por "e-mail nenhum" — que é pior. O que o
     * destinatário perde é o arquivo; o que ele não pode perder é o aviso.
     */
    if (attachment) attachments.push(attachment)
  }

  return attachments
}

/**
 * O payload é `Record<string, unknown>` — ele atravessa JSON e vem do produto. Um cast aqui
 * deixaria um `filename` numérico chegar ao cabeçalho MIME.
 */
function toAttachment(value: unknown): EmailAttachment | undefined {
  if (typeof value !== 'object' || value === null) return undefined

  const candidate = value as Record<string, unknown>
  const { filename, url, contentType } = candidate

  if (typeof filename !== 'string' || typeof url !== 'string' || typeof contentType !== 'string') return undefined

  return { filename, url, contentType }
}
