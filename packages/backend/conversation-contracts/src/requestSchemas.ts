/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Schemas de fronteira (RNF3): `.strict()` em todo objeto de corpo de requisição — sem isso a
 * inferência do zod degrada campo obrigatório para opcional no `.d.ts` publicado
 * (`companyId?: string` em vez de `companyId: string`), e o `company_id`/`companyId` que o cliente
 * mandar sobreviveria ao parse. `companyId` **nunca** aparece em nenhum destes schemas — o tenant
 * vem sempre do contexto autenticado do host, nunca do corpo (T203, `strictness.test.ts`).
 */
import { z } from 'zod'

export const openConversationParticipantSchema = z
  .object({
    channel: z.string().min(1),
    identifier: z.string().min(1).max(320),
  })
  .strict()

export const openConversationBodySchema = z
  .object({
    subjectType: z.string().min(1).max(64).optional(),
    subjectId: z.string().min(1).max(128).optional(),
    audience: z.string().min(1).max(64).optional(),
    participants: z.array(openConversationParticipantSchema).min(1).max(10),
  })
  .strict()
export type OpenConversationBody = z.infer<typeof openConversationBodySchema>

export const sendMessageBodySchema = z
  .object({
    channel: z.string().min(1),
    bodyText: z.string().min(1).max(8000),
  })
  .strict()
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>

export const markConversationReadBodySchema = z
  .object({
    lastReadMessageId: z.string().min(1),
  })
  .strict()
export type MarkConversationReadBody = z.infer<typeof markConversationReadBodySchema>

/** Mesmo teto de `CONVERSATION_QUICK_REPLY_MAX_LENGTH` (`conversation-module/schema.ts`) — não
 * importado daqui porque o contracts nunca depende do module (sentido inverso da dependência). */
export const quickReplyBodySchema = z
  .object({
    audience: z.string().min(1).max(64),
    bodyText: z.string().min(1).max(500),
    position: z.number().int().min(0).optional(),
  })
  .strict()
export type QuickReplyBody = z.infer<typeof quickReplyBodySchema>
