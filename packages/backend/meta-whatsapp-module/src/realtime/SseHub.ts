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
type RelayEnvelope = {
  originId: string
  event: string
  payload: Record<string, unknown>
}

export class SseHub implements RealtimeNotifierInterface {
  private readonly localListeners = new Map<string, Set<SseListener>>()
  // Uma assinatura de relay por CANAL, compartilhada por todos os listeners locais dele — uma
  // por listener faria o relay entregar N cópias num canal com N conexões abertas.
  private readonly relaySubscriptions = new Map<string, Promise<() => void>>()
  // Identifica esta instância do processo para descartar o próprio eco (pub/sub entrega a
  // mensagem a todos os inscritos, inclusive quem publicou).
  private readonly instanceId = randomUUID()

  constructor(private readonly relay?: RealtimeRelay) {}

  emit(channel: string, event: string, payload: Record<string, unknown>): void {
    this.dispatchLocal(channel, event, payload)
    if (this.relay) {
      const envelope: RelayEnvelope = { originId: this.instanceId, event, payload }
      this.relay.publish(channel, JSON.stringify(envelope)).catch(() => undefined)
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

    if (this.relay && !this.relaySubscriptions.has(channel)) {
      this.relaySubscriptions.set(
        channel,
        this.relay.subscribe(channel, (message) => {
          try {
            const envelope = JSON.parse(message) as RelayEnvelope
            // Eco do que nós mesmos publicamos: dispatchLocal já entregou em emit().
            if (envelope.originId === this.instanceId) return
            this.dispatchLocal(channel, envelope.event, envelope.payload)
          } catch {
            // mensagem de relay malformada — ignora, não derruba a conexão
          }
        }),
      )
    }

    return () => {
      const listeners = this.localListeners.get(channel)
      listeners?.delete(listener)
      // Último listener do canal saiu: solta a assinatura do relay e a chave do Map, senão
      // canais efêmeros (conv:<numero>) se acumulam pelo uptime inteiro do processo.
      if (listeners && listeners.size === 0) {
        this.localListeners.delete(channel)
        const pendingUnsubscribe = this.relaySubscriptions.get(channel)
        this.relaySubscriptions.delete(channel)
        pendingUnsubscribe?.then((unsubscribe) => unsubscribe()).catch(() => undefined)
      }
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
