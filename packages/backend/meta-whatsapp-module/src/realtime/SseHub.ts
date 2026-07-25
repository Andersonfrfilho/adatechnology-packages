import { randomUUID } from 'node:crypto'
import type { RealtimeNotifierInterface } from '@adatechnology/meta-whatsapp-contracts'

export type SseListener = (event: string, payload: Record<string, unknown>) => void

// Porta mínima de cache para o ticket de conexão SSE — qualquer TTL cache do host serve
// (Redis, in-memory); o módulo não assume Redis especificamente.
export interface TicketStoreInterface {
  set(key: string, value: string, ttlSeconds: number): Promise<void>
  get(key: string): Promise<string | null>
  delete(key: string): Promise<void>
}

// Publica localmente e, se um relay for injetado (ex.: Redis pub/sub), propaga entre processos
// — várias instâncias do host atrás de um load balancer recebem o mesmo evento (T3.4).
export interface RealtimeRelay {
  publish(channel: string, message: string): Promise<void>
  subscribe(channel: string, onMessage: (message: string) => void): Promise<() => void>
}

const TICKET_TTL_SECONDS = 60

// T3.4 — hub de tempo real atrás da porta RealtimeNotifierInterface (contracts). O host pode
// trocar por WebSocket ou desligar sem o resto do módulo saber — ver providers.ts.
export class SseHub implements RealtimeNotifierInterface {
  private readonly localListeners = new Map<string, Set<SseListener>>()

  constructor(private readonly relay?: RealtimeRelay) {}

  emit(channel: string, event: string, payload: Record<string, unknown>): void {
    this.dispatchLocal(channel, event, payload)
    if (this.relay) {
      this.relay.publish(channel, JSON.stringify({ event, payload })).catch(() => undefined)
    }
  }

  private dispatchLocal(channel: string, event: string, payload: Record<string, unknown>): void {
    const listeners = this.localListeners.get(channel)
    if (!listeners) return
    for (const listener of listeners) listener(event, payload)
  }

  async subscribe(channel: string, listener: SseListener): Promise<() => void> {
    if (!this.localListeners.has(channel)) this.localListeners.set(channel, new Set())
    this.localListeners.get(channel)!.add(listener)

    let unsubscribeRelay: (() => void) | undefined
    if (this.relay) {
      unsubscribeRelay = await this.relay.subscribe(channel, (message) => {
        try {
          const { event, payload } = JSON.parse(message) as { event: string; payload: Record<string, unknown> }
          listener(event, payload)
        } catch {
          // mensagem de relay malformada — ignora, não derruba a conexão
        }
      })
    }

    return () => {
      this.localListeners.get(channel)?.delete(listener)
      unsubscribeRelay?.()
    }
  }
}

// EventSource do browser não manda headers customizados — o ticket vai na query string da URL
// de conexão e expira em 60s, curto o bastante para não valer a pena capturar e reusar depois.
export async function issueSseTicket(
  store: TicketStoreInterface,
  companyId: string,
  whatsappNumber: string,
): Promise<string> {
  const ticket = randomUUID()
  await store.set(`sse:ticket:${ticket}`, JSON.stringify({ companyId, whatsappNumber }), TICKET_TTL_SECONDS)
  return ticket
}

export async function redeemSseTicket(
  store: TicketStoreInterface,
  ticket: string,
): Promise<{ companyId: string; whatsappNumber: string } | null> {
  const raw = await store.get(`sse:ticket:${ticket}`)
  if (!raw) return null
  await store.delete(`sse:ticket:${ticket}`)
  return JSON.parse(raw) as { companyId: string; whatsappNumber: string }
}
