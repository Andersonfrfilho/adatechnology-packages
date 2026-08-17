/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Adaptador WHATWG — serve `Bun.serve` direto, o `Router` do quickcart e qualquer host baseado
 * em `Request`/`Response`. Só traduz transporte: toda decisão de comportamento está em
 * `dispatchRoute`.
 */

import type { AuthContextResolverPort, LoggerPort, HttpResult, ModuleRouteTable, SseEvent } from './types'

import {
  compileRoutes,
  dispatchRoute,
  findRoute,
  parseQueryParams,
  MAX_REQUEST_BODY_BYTES,
  type CompiledRoute,
} from './dispatchRoute'

export type ModuleFetchRouter = {
  /** `true` quando o pedido pertence ao módulo — o host decide se delega antes do próprio 404. */
  match(request: Request): boolean
  handle(request: Request): Promise<Response>
  readonly routes: ModuleRouteTable
}

export type CreateModuleFetchRouterParams = {
  readonly routes: ModuleRouteTable
  readonly basePath?: string
  readonly authResolver?: AuthContextResolverPort
  readonly logger?: LoggerPort
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {}
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value
  })
  return record
}

function formatSseChunk(event: SseEvent): string {
  const lines: string[] = []
  if (event.id) lines.push(`id: ${event.id}`)
  if (event.event) lines.push(`event: ${event.event}`)
  // `data` multilinha precisa de um `data:` por linha, senão o cliente corta no primeiro \n.
  for (const line of event.data.split('\n')) lines.push(`data: ${line}`)
  return `${lines.join('\n')}\n\n`
}

function toStreamResponse(result: Extract<HttpResult, { kind: 'stream' }>, signal: AbortSignal): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const safeEnqueue = (chunk: string): void => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          // Cliente sumiu entre o check e o enqueue — nada a fazer além de parar de escrever.
          closed = true
        }
      }

      const subscription = await result.subscribe((event) => safeEnqueue(formatSseChunk(event)))

      // Comentário SSE (`:`) como heartbeat: mantém a conexão viva sem virar evento no cliente.
      // O `idleTimeout` do Bun.serve precisa ser MAIOR que este intervalo, ou a conexão morre
      // antes do primeiro batimento (foi o que aconteceu no quickcart).
      const heartbeat = setInterval(() => safeEnqueue(': heartbeat\n\n'), result.heartbeatSeconds * 1000)

      const finish = (): void => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        subscription.close()
        try {
          controller.close()
        } catch {
          // Já fechado pelo runtime.
        }
      }

      signal.addEventListener('abort', finish, { once: true })
      if (signal.aborted) finish()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Sem isto, um proxy com buffering (nginx default) segura os eventos e o stream "não chega".
      'X-Accel-Buffering': 'no',
    },
  })
}

export function toFetchResponse(result: HttpResult, signal: AbortSignal): Response {
  if (result.kind === 'stream') return toStreamResponse(result, signal)
  if (result.kind === 'empty') return new Response(null, { status: result.status, headers: result.headers })

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json', ...result.headers },
  })
}

export function createModuleFetchRouter(params: CreateModuleFetchRouterParams): ModuleFetchRouter {
  const compiledRoutes: CompiledRoute[] = compileRoutes(params.routes, params.basePath ?? '')

  return {
    routes: params.routes,

    match(request: Request): boolean {
      const { pathname } = new URL(request.url)
      return findRoute(compiledRoutes, { method: request.method, pathname }) !== undefined
    },

    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url)
      const query = parseQueryParams(url.searchParams)

      // Lê os bytes crus e não `request.json()`: a assinatura HMAC do webhook é calculada sobre
      // eles, e reserializar o JSON muda espaçamento e ordem de chave.
      const rawBody =
        request.method === 'GET' || request.method === 'DELETE'
          ? undefined
          : new Uint8Array(await request.arrayBuffer())

      // H-B: `uws.ts` rejeita cedo, por streaming; aqui o corpo já chegou inteiro (a Fetch API não
      // dá gancho de leitura incremental), mas o teto continua o mesmo — sem isto, o adaptador
      // fetch aceitava um corpo de qualquer tamanho que o uws.ts já recusava com 413.
      if (rawBody !== undefined && rawBody.byteLength > MAX_REQUEST_BODY_BYTES) {
        return toFetchResponse({ kind: 'empty', status: 413 }, request.signal)
      }

      const result = await dispatchRoute({
        compiledRoutes,
        request: {
          method: request.method,
          pathname: url.pathname,
          query,
          headers: headersToRecord(request.headers),
          rawBody,
        },
        authResolver: params.authResolver,
        logger: params.logger,
      })

      if (!result) return new Response(null, { status: 404 })
      return toFetchResponse(result, request.signal)
    },
  }
}
