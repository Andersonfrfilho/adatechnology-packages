/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF14, CA07: o threading RFC 5322 do canal e-mail — `In-Reply-To`/`References` da mensagem que
 * está sendo respondida, e o `Idempotency-Key` do envio. Regra pura, sem I/O: quem acha a última
 * mensagem **recebida** da conversa é o host, pela `ConversationEmailTransportPort`; esta função só
 * decide os cabeçalhos a partir do que ele achar.
 *
 * Sem mensagem recebida anterior os dois campos ficam **ausentes**, nunca string vazia — um
 * `In-Reply-To` vazio ainda é um cabeçalho presente, e provedor nenhum trata isso como "não é
 * resposta a nada".
 *
 * A origem (spec 143) não acumula cadeia: ela repete o `Message-ID` da última mensagem recebida em
 * `In-Reply-To` **e** `References`, sem olhar as `References` que aquela mensagem trazia — por isso
 * não tem teto próprio para portar. Esta função generaliza para a cadeia inteira (RFC 5322
 * recomenda preservar a árvore da conversa), e precisa de um teto para não deixar o cabeçalho
 * crescer sem limite numa conversa longa.
 */

/** `local-part@domain`, com ou sem os `< >` do cabeçalho — não valida contra a RFC inteira, só recusa entrada crua. */
const MESSAGE_ID_PATTERN = /^[^\s<>@]+@[^\s<>@]+$/u

/**
 * 50 entradas: valor citado com frequência como o teto que clientes de e-mail populares aplicam a
 * `References` para limitar o tamanho do cabeçalho sem cortar conversas de uso normal. O mais
 * antigo cai primeiro; a mensagem que está sendo respondida nunca sai, porque entra por último.
 */
export const EMAIL_THREADING_REFERENCES_MAX_COUNT = 50

export type LastInboundEmailMessage = {
  readonly messageId: string
  readonly references?: readonly string[]
}

export type BuildEmailThreadingHeadersInput = {
  /** O id da nossa mensagem — vira o `Idempotency-Key` do envio. */
  readonly messageId: string
  readonly lastInboundMessage?: LastInboundEmailMessage
}

export type EmailThreadingHeaders = {
  readonly idempotencyKey: string
  readonly inReplyTo?: string
  readonly references?: readonly string[]
}

function normalizeMessageId(rawId: string): string | undefined {
  const trimmed = rawId.trim().replace(/^<|>$/gu, '')
  return MESSAGE_ID_PATTERN.test(trimmed) ? trimmed : undefined
}

function dedupePreservingOrder(ids: readonly string[]): string[] {
  return [...new Set(ids)]
}

export function buildEmailThreadingHeaders(input: BuildEmailThreadingHeadersInput): EmailThreadingHeaders {
  const idempotencyKey = input.messageId
  const lastInbound = input.lastInboundMessage
  if (lastInbound === undefined) return { idempotencyKey }

  const inReplyTo = normalizeMessageId(lastInbound.messageId)
  if (inReplyTo === undefined) return { idempotencyKey }

  const priorReferences = (lastInbound.references ?? [])
    .map(normalizeMessageId)
    .filter((id): id is string => id !== undefined)
  const references = dedupePreservingOrder([...priorReferences, inReplyTo]).slice(-EMAIL_THREADING_REFERENCES_MAX_COUNT)

  return { idempotencyKey, inReplyTo, references }
}
