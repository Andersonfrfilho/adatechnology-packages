export interface HttpTransportConfig {
  sinkUrl?: string
  batchSize?: number
  flushIntervalMs?: number
  maxQueueSize?: number
}

const DEFAULT_BATCH_SIZE = 100
const DEFAULT_FLUSH_INTERVAL_MS = 1000
const DEFAULT_MAX_QUEUE_SIZE = 1000

/**
 * Entrega de log nunca pode derrubar nem travar a aplicação: fila com teto (o mais antigo cai
 * quando lota) e descarte silencioso em falha de rede — sem retry, sem exceção subindo.
 */
export class HttpTransport {
  private readonly sinkUrl: string
  private readonly enabled: boolean
  private readonly batchSize: number
  private readonly maxQueueSize: number
  private readonly timer: ReturnType<typeof setInterval> | null

  private queue: string[] = []
  private flushPromise: Promise<void> | null = null

  constructor(config: HttpTransportConfig) {
    this.sinkUrl = config.sinkUrl ?? ''
    this.enabled = this.sinkUrl.length > 0
    this.batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE
    this.maxQueueSize = config.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE

    if (this.enabled) {
      const flushIntervalMs = config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS
      this.timer = setInterval(() => void this.flush(), flushIntervalMs)
      this.timer.unref?.()
    } else {
      this.timer = null
    }
  }

  enqueue(entry: Record<string, unknown>): void {
    if (!this.enabled) return

    if (this.queue.length >= this.maxQueueSize) this.queue.shift()
    this.queue.push(JSON.stringify(entry))

    if (this.queue.length >= this.batchSize) void this.flush()
  }

  /**
   * Uma única fila de drenagem por vez: enfileirar durante um flush em andamento entra no mesmo
   * ciclo em vez de disparar um segundo fetch concorrente — quem chama flush() nesse meio-tempo
   * recebe a mesma promise e espera o esvaziamento real, não um retorno prematuro.
   */
  flush(): Promise<void> {
    if (!this.enabled) return Promise.resolve()
    if (this.flushPromise) return this.flushPromise
    if (this.queue.length === 0) return Promise.resolve()

    this.flushPromise = this.drain().finally(() => {
      this.flushPromise = null
    })
    return this.flushPromise
  }

  private async drain(): Promise<void> {
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize)
      try {
        await fetch(this.sinkUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/x-ndjson' },
          body: `${batch.join('\n')}\n`,
        })
      } catch {
        break
      }
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }
}
