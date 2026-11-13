/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Há quanto tempo o cliente espera resposta.
 *
 * Não confundir com `conversationWindow`: aquilo é a janela de sessão da plataforma (o que o canal
 * ainda deixa enviar), isto é serviço (quanto o cliente esperou). Os dois divergem justamente no
 * caso que interessa — respondida a conversa, o relógio do SLA para e o da janela continua correndo.
 *
 * A conta sai de dados que a listagem já traz: se a última mensagem foi do cliente, ninguém
 * respondeu ainda e a espera conta desde ela. Se a última foi nossa, não há espera pendente.
 */

const HOUR_MS = 60 * 60 * 1000

export const REPLY_LATENCY = {
  /** Até 6h — dentro do combinado. */
  WITHIN: 'within',
  /** 6h a 12h — passou do combinado. */
  LATE: 'late',
  /** Acima de 12h. */
  CRITICAL: 'critical',
} as const
export type ReplyLatency = (typeof REPLY_LATENCY)[keyof typeof REPLY_LATENCY]

export const REPLY_LATENCY_LATE_HOURS = 6
export const REPLY_LATENCY_CRITICAL_HOURS = 12

export type ReplyLatencyParams = {
  /** Direção da última mensagem. Ausente = desconhecida, e aí não se afirma espera. */
  readonly lastDirection?: 'inbound' | 'outbound' | undefined
  readonly lastInboundAt: string | null
  readonly now: number
}

/**
 * `null` quando não há espera a mostrar — conversa já respondida, ou cliente que nunca escreveu.
 *
 * Devolver uma faixa nesses casos encheria a lista de selos em conversa que não deve nada, e o
 * alerta que aponta para todo lado não aponta para lugar nenhum.
 */
export function replyLatencyOf(params: ReplyLatencyParams): ReplyLatency | null {
  if (params.lastDirection !== 'inbound') return null
  if (!params.lastInboundAt) return null

  const elapsedHours = (params.now - new Date(params.lastInboundAt).getTime()) / HOUR_MS
  // Espera negativa é relógio fora de sincronia entre servidor e navegador, não conversa do futuro:
  // tratar como recém-chegada evita um selo "crítico" nascido de alguns segundos de diferença.
  if (elapsedHours < REPLY_LATENCY_LATE_HOURS) return REPLY_LATENCY.WITHIN
  if (elapsedHours < REPLY_LATENCY_CRITICAL_HOURS) return REPLY_LATENCY.LATE
  return REPLY_LATENCY.CRITICAL
}

/** Só o que passou do combinado merece alerta — é o corte que a lista usa para destacar. */
export function isReplyOverdue(latency: ReplyLatency | null): boolean {
  return latency === REPLY_LATENCY.LATE || latency === REPLY_LATENCY.CRITICAL
}
