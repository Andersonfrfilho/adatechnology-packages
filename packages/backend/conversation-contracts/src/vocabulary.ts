/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O vocabulário do núcleo de conversa (RF1): canal, direção, status de entrega, resultado de DKIM
 * e tipo de anexo. Contrato de host (RNF7) — os nomes vêm do que a 183 já grava, exceto `webchat`,
 * que nasce aqui porque é o canal que o `conversations-ui` já declara. Renomear, trocar ou tirar um
 * valor é major version; acrescentar é minor.
 */
import { z } from 'zod'

export const CONVERSATION_CHANNEL = Object.freeze(['email', 'whatsapp', 'app', 'portal', 'webchat'] as const)
export type ConversationChannel = (typeof CONVERSATION_CHANNEL)[number]
export const conversationChannelSchema = z.enum(CONVERSATION_CHANNEL)

export const MESSAGE_DIRECTION = Object.freeze(['inbound', 'outbound'] as const)
export type MessageDirection = (typeof MESSAGE_DIRECTION)[number]
export const messageDirectionSchema = z.enum(MESSAGE_DIRECTION)

/** A união dos estados que os canais alcançam juntos; o que cada canal alcança é da tabela de capacidades (RF2). */
export const MESSAGE_DELIVERY_STATUS = Object.freeze([
  'queued',
  'sent',
  'delivered',
  'read',
  'failed',
  'bounced',
] as const)
export type MessageDeliveryStatus = (typeof MESSAGE_DELIVERY_STATUS)[number]
export const messageDeliveryStatusSchema = z.enum(MESSAGE_DELIVERY_STATUS)

export const DKIM_RESULT = Object.freeze(['aligned', 'not_aligned', 'unverifiable', 'absent'] as const)
export type DkimResult = (typeof DKIM_RESULT)[number]
export const dkimResultSchema = z.enum(DKIM_RESULT)

export const ATTACHMENT_KIND = Object.freeze(['audio', 'document', 'image'] as const)
export type AttachmentKind = (typeof ATTACHMENT_KIND)[number]
export const attachmentKindSchema = z.enum(ATTACHMENT_KIND)
