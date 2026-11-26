import { z } from 'zod'

/**
 * Limites da resposta rápida. Título, atalho e texto seguem o que o `conversations-ui` já valida
 * antes de chamar a API; o servidor repete a regra porque a tela é conveniência, não fronteira.
 */
export const QUICK_REPLY_LIMITS = {
  TITLE_MAX_LENGTH: 40,
  SHORTCUT_MAX_LENGTH: 20,
  // Abaixo dos 4096 caracteres do texto do WhatsApp de propósito: sobra espaço para os `{{marcador}}`
  // virarem nome, data e afins sem estourar o teto da Meta depois de interpolados.
  BODY_MAX_LENGTH: 1000,
  SEARCH_MAX_LENGTH: 100,
  MAX_SORT_ORDER: 100_000,
  // Teto por empresa: a lista volta inteira para o seletor do composer, sem paginação.
  MAX_PER_COMPANY: 500,
} as const

/** Digitado depois do `/` no composer: minúsculas, números e hífen, sem acento nem espaço. */
export const QUICK_REPLY_SHORTCUT_PATTERN = /^[a-z0-9-]{1,20}$/

export const QUICK_REPLY_ERROR_CODES = {
  NOT_FOUND: 'QUICK_REPLY_NOT_FOUND',
  // Valor fixo: é o código que o `QuickRepliesWorkspace` do conversations-ui reconhece para mostrar
  // "atalho já em uso" no campo certo.
  SHORTCUT_TAKEN: 'QUICK_REPLY_SHORTCUT_TAKEN',
  LIMIT_REACHED: 'QUICK_REPLY_LIMIT_REACHED',
} as const

export const whatsAppQuickReplyInputSchema = z.object({
  title: z.string().trim().min(1).max(QUICK_REPLY_LIMITS.TITLE_MAX_LENGTH),
  shortcut: z.string().regex(QUICK_REPLY_SHORTCUT_PATTERN, 'Use minúsculas, números e hífen (até 20).'),
  body: z.string().trim().min(1).max(QUICK_REPLY_LIMITS.BODY_MAX_LENGTH),
  /** Ausente: na criação vai para o fim da lista; na edição mantém a posição. */
  sortOrder: z.number().int().min(0).max(QUICK_REPLY_LIMITS.MAX_SORT_ORDER).optional(),
})

export const listWhatsAppQuickRepliesQuerySchema = z.object({
  search: z.string().trim().max(QUICK_REPLY_LIMITS.SEARCH_MAX_LENGTH).optional(),
})

export type WhatsAppQuickReplyInput = z.infer<typeof whatsAppQuickReplyInputSchema>
export type ListWhatsAppQuickRepliesQuery = z.infer<typeof listWhatsAppQuickRepliesQuerySchema>

/** Formato que a API devolve; casa com o `QuickReply` do conversations-ui (campos a mais são ignorados lá). */
export type WhatsAppQuickReply = {
  readonly id: string
  readonly title: string
  readonly shortcut: string
  readonly body: string
  readonly sortOrder: number
  readonly createdAt: string
  readonly updatedAt: string
}
