/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Assinatura do SSE do inbox.
 *
 * **Não usa `EventSource`**, apesar de ser a API óbvia: `EventSource` não aceita headers, e a
 * autenticação do host é `Authorization: Bearer`. Passar token por query string violaria
 * `security.md` §Privacy (credencial em URL vaza em log de proxy e histórico). Além disso o React
 * Native não tem `EventSource` nativo. Ler o corpo por `fetch` + `ReadableStream` resolve os dois
 * de uma vez, e é o que roda igual no web e no RN moderno.
 */

export type NotificationStreamEvent = {
  readonly event: string
  readonly data: unknown
}

export type SubscribeToNotificationStreamParams = {
  readonly url: string
  readonly headers: Record<string, string>
  readonly onEvent: (event: NotificationStreamEvent) => void
  readonly onError?: (error: Error) => void
  readonly fetchImpl?: typeof fetch
  /** Reconexão com backoff; `0` desliga (o chamador cuida). */
  readonly reconnectDelayMs?: number
}

export type NotificationStreamSubscription = {
  close(): void
}

const DEFAULT_RECONNECT_DELAY_MS = 3000

function parseSseBlock(block: string): NotificationStreamEvent | undefined {
  let eventName = 'message'
  const dataLines: string[] = []

  for (const line of block.split('\n')) {
    // Comentário SSE — é o heartbeat do servidor, e não deve virar evento no cliente.
    if (line.startsWith(':')) continue
    if (line.startsWith('event:')) eventName = line.slice('event:'.length).trim()
    if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trim())
  }

  if (dataLines.length === 0) return undefined

  const raw = dataLines.join('\n')
  try {
    return { event: eventName, data: JSON.parse(raw) }
  } catch {
    return { event: eventName, data: raw }
  }
}

export function subscribeToNotificationStream(
  params: SubscribeToNotificationStreamParams,
): NotificationStreamSubscription {
  const fetchImpl = params.fetchImpl ?? fetch
  const controller = new AbortController()
  let closed = false

  async function connect(): Promise<void> {
    const response = await fetchImpl(params.url, {
      headers: { ...params.headers, Accept: 'text/event-stream' },
      signal: controller.signal,
    })

    if (!response.ok || !response.body) throw new Error(`SSE falhou com status ${response.status}`)

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    for (;;) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      // Eventos SSE são separados por linha em branco; o resto fica no buffer porque um chunk
      // de rede pode cortar um evento no meio.
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() ?? ''

      for (const block of blocks) {
        const event = parseSseBlock(block)
        if (event) params.onEvent(event)
      }
    }
  }

  async function runWithReconnect(): Promise<void> {
    const delay = params.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS

    while (!closed) {
      try {
        await connect()
      } catch (error) {
        if (closed) return
        params.onError?.(error instanceof Error ? error : new Error(String(error)))
      }

      // Conexão encerrada pelo servidor (deploy, timeout de proxy) é o caso comum — reconectar é
      // o comportamento certo, e sem `delay` viraria laço apertado contra um servidor caído.
      if (closed || delay === 0) return
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  void runWithReconnect()

  return {
    close(): void {
      closed = true
      controller.abort()
    },
  }
}
