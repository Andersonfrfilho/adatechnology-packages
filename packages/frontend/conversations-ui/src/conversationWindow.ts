/**
 * Janela de sessão: o intervalo em que o canal aceita mensagem livre do atendente. No WhatsApp são
 * 24h desde o último contato do cliente; fora dela só template. Cada canal tem a sua regra — e há
 * canal sem janela nenhuma — então a política vem de `capabilitiesOf`, não de constante fixa.
 *
 * Mora no SDK porque é regra de plataforma, não de produto: todo projeto que usa este pacote
 * precisa dela para saber o que o atendente ainda consegue fazer.
 */

import { capabilitiesOf, type ConversationChannel } from './conversationChannel'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

export const CONVERSATION_WINDOW = {
  ALL: 'all',
  FRESH: 'fresh',
  WARNING: 'warning',
  CRITICAL: 'critical',
  EXPIRED: 'expired',
} as const
export type ConversationWindow = (typeof CONVERSATION_WINDOW)[keyof typeof CONVERSATION_WINDOW]

// O tom pinta o próprio chip, em vez de uma bolinha ao lado do rótulo: a bolinha somava ~14px por
// filtro e era o que fazia a fila de cinco quebrar em duas linhas na coluna da lista.
export const WINDOW_FILTERS = [
  { value: CONVERSATION_WINDOW.ALL, label: 'Todas', tone: '' },
  { value: CONVERSATION_WINDOW.FRESH, label: '<12h', tone: 'fresh' },
  { value: CONVERSATION_WINDOW.WARNING, label: '12-21h', tone: 'warning' },
  { value: CONVERSATION_WINDOW.CRITICAL, label: '21-24h', tone: 'critical' },
  { value: CONVERSATION_WINDOW.EXPIRED, label: '>24h', tone: 'expired' },
] as const

// Proporções da janela: 12h e 21h numa janela de 24h, mas expressas como fração para acompanharem
// canais com janela de outro tamanho.
const WARNING_RATIO = 0.5
const CRITICAL_RATIO = 0.875

export type WindowOfParams = {
  readonly lastInboundAt: string | null
  readonly now: number
  /** Ausente = `whatsapp`. */
  readonly channel?: ConversationChannel | undefined
}

/**
 * Sem `lastInboundAt` o cliente nunca escreveu, então não há janela aberta — classificar como
 * expirada é o comportamento seguro: evita o atendente tentar texto livre e receber recusa.
 *
 * Canal sem janela de sessão (chat de site) é sempre `fresh`: ali nada expira, e marcar expirado
 * bloquearia o composer inventando um limite que a plataforma não impõe.
 */
export function windowOf(params: WindowOfParams): ConversationWindow {
  const capabilities = capabilitiesOf(params.channel)
  if (!capabilities.hasSessionWindow) return CONVERSATION_WINDOW.FRESH

  if (!params.lastInboundAt) return CONVERSATION_WINDOW.EXPIRED

  const windowMs = capabilities.windowHours * HOUR_MS
  const elapsed = params.now - new Date(params.lastInboundAt).getTime()

  if (elapsed >= windowMs) return CONVERSATION_WINDOW.EXPIRED
  // Faixas proporcionais à janela do canal, e não fixas em 12h/21h: um canal com janela diferente
  // de 24h teria os avisos nos lugares errados.
  if (elapsed >= windowMs * CRITICAL_RATIO) return CONVERSATION_WINDOW.CRITICAL
  if (elapsed >= windowMs * WARNING_RATIO) return CONVERSATION_WINDOW.WARNING
  return CONVERSATION_WINDOW.FRESH
}

export function formatStalledFor(lastAt: string, now: number): string {
  const elapsed = Math.max(0, now - new Date(lastAt).getTime())
  const days = Math.floor(elapsed / DAY_MS)
  const hours = Math.floor((elapsed % DAY_MS) / HOUR_MS)
  const minutes = Math.floor((elapsed % HOUR_MS) / MINUTE_MS)

  if (days > 0) return `${days}d ${hours}h:${String(minutes).padStart(2, '0')}m`
  if (hours > 0) return `${hours}h:${String(minutes).padStart(2, '0')}m`
  return `${minutes}m`
}
