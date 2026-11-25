/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Comando semântico do simulador (o QUE o cliente fez) → payload da Meta, montado no servidor.
 *
 * Mora aqui, e não na UI, porque o servidor é quem monta o payload: com o tipo só no front, cada
 * host reescrevia o `switch` e esquecia o `phoneNumberId` — o webhook descartava a entrega simulada
 * no filtro de número, sem erro nenhum.
 */

import type { WhatsAppWebhookPayload } from '../webhook.types'
import {
  buildInboundAudioPayload,
  buildInboundInteractivePayload,
  buildInboundMediaPayload,
  buildInboundTextPayload,
  type InboundMediaType,
  type InteractiveReplyOption,
} from './inboundPayloads'

export type PreviewMediaCommandFields = {
  readonly mediaType: InboundMediaType
  readonly mediaId: string
  readonly mimeType?: string
  readonly filename?: string
  readonly caption?: string
}

export type PreviewInboundCommand =
  | { readonly kind: 'text'; readonly from: string; readonly text: string }
  | { readonly kind: 'buttonReply'; readonly from: string; readonly reply: InteractiveReplyOption }
  | { readonly kind: 'listReply'; readonly from: string; readonly reply: InteractiveReplyOption }
  | { readonly kind: 'audio'; readonly from: string; readonly mediaId: string }
  | ({ readonly kind: 'media'; readonly from: string } & PreviewMediaCommandFields)

export type PreviewPayloadEnvelope = {
  /** O `phone_number_id` do host — sem ele o webhook descarta a entrega como de outro número. */
  readonly phoneNumberId: string
  readonly displayPhoneNumber?: string
  readonly wabaId?: string
  readonly profileName?: string
}

export function buildPreviewInboundPayload(
  command: PreviewInboundCommand,
  envelope: PreviewPayloadEnvelope,
): WhatsAppWebhookPayload {
  const base = { ...envelope, from: command.from }
  switch (command.kind) {
    case 'text':
      return buildInboundTextPayload({ ...base, text: command.text })
    case 'buttonReply':
      return buildInboundInteractivePayload({ ...base, buttonReply: command.reply })
    case 'listReply':
      return buildInboundInteractivePayload({ ...base, listReply: command.reply })
    case 'audio':
      return buildInboundAudioPayload({ ...base, mediaId: command.mediaId })
    case 'media':
      return buildInboundMediaPayload({
        ...base,
        mediaType: command.mediaType,
        mediaId: command.mediaId,
        ...(command.mimeType ? { mimeType: command.mimeType } : {}),
        ...(command.filename ? { filename: command.filename } : {}),
        ...(command.caption ? { caption: command.caption } : {}),
      })
  }
}
