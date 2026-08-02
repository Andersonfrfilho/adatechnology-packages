/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Adaptador uWebSockets.js — para o template `micro-backend-uws`. Só traduz transporte: toda
 * decisão de comportamento está em `dispatchRoute`, a mesma que o adaptador `fetch` usa.
 *
 * Três armadilhas do uWS que este arquivo existe para encapsular:
 * 1. `res` fica **inválido** depois que o cliente aborta — daí `onAborted` marcar uma flag antes
 *    de qualquer escrita assíncrona.
 * 2. Todo `req` (headers, url, query) precisa ser lido **de forma síncrona**, antes do primeiro
 *    `await`; depois disso o objeto é reciclado pelo runtime e devolve lixo.
 * 3. Escrita fora de `cork()` gera um pacote de rede por chamada.
 */

import type {
  AuthContextResolverPort,
  LoggerPort,
  NotificationHttpResult,
  NotificationRouteTable,
  SseEvent,
} from '@adatechnology/notification-contracts'

import { compileRoutes, dispatchRoute, type CompiledRoute } from './dispatchRoute'

// Forma mínima do uWS que este adaptador consome — declarada por estrutura para o pacote não
// depender do addon em tempo de tipo (quem não importa `/http/uws` não instala `uWebSockets.js`).
export type UwsResponse = {
  writeStatus(status: string): UwsResponse
  writeHeader(key: string, value: string): UwsResponse
  write(chunk: string): boolean
  end(body?: string): UwsResponse
  cork(callback: () => void): void
  onAborted(callback: () => void): void
  onData(callback: (chunk: ArrayBuffer, isLast: boolean) => void): void
}

export type UwsRequest = {
  getMethod(): string
  getUrl(): string
  getQuery(): string
  forEach(callback: (key: string, value: string) => void): void
}

export type UwsApp = {
  get(pattern: string, handler: (res: UwsResponse, req: UwsRequest) => void): UwsApp
  post(pattern: string, handler: (res: UwsResponse, req: UwsRequest) => void): UwsApp
  put(pattern: string, handler: (res: UwsResponse, req: UwsRequest) => void): UwsApp
  patch(pattern: string, handler: (res: UwsResponse, req: UwsRequest) => void): UwsApp
  del(pattern: string, handler: (res: UwsResponse, req: UwsRequest) => void): UwsApp
}

export type MountNotificationRoutesParams = {
  readonly app: UwsApp
  readonly routes: NotificationRouteTable
  readonly basePath?: string
  readonly authResolver?: AuthContextResolverPort
  readonly logger?: LoggerPort
}

const STATUS_TEXT: Record<number, string> = {
  200: '200 OK',
  201: '201 Created',
  204: '204 No Content',
  400: '400 Bad Request',
  401: '401 Unauthorized',
  403: '403 Forbidden',
  404: '404 Not Found',
  409: '409 Conflict',
  422: '422 Unprocessable Entity',
  429: '429 Too Many Requests',
  500: '500 Internal Server Error',
}

function statusText(status: number): string {
  return STATUS_TEXT[status] ?? `${status} `
}

function formatSseChunk(event: SseEvent): string {
  const lines: string[] = []
  if (event.id) lines.push(`id: ${event.id}`)
  if (event.event) lines.push(`event: ${event.event}`)
  for (const line of event.data.split('\n')) lines.push(`data: ${line}`)
  return `${lines.join('\n')}\n\n`
}

function readRawBody(response: UwsResponse, hasBody: boolean): Promise<Uint8Array | undefined> {
  if (!hasBody) return Promise.resolve(undefined)

  return new Promise((resolve) => {
    const chunks: Uint8Array[] = []
    response.onData((chunk, isLast) => {
      // Cópia obrigatória: o ArrayBuffer que o uWS entrega é reaproveitado no próximo chunk, e
      // guardar a referência crua daria um corpo corrompido em requisição fragmentada.
      chunks.push(new Uint8Array(chunk.slice(0)))
      if (!isLast) return

      const total = chunks.reduce((size, part) => size + part.length, 0)
      const merged = new Uint8Array(total)
      let offset = 0
      for (const part of chunks) {
        merged.set(part, offset)
        offset += part.length
      }
      resolve(merged)
    })
  })
}

function parseQueryString(queryString: string): Record<string, string> {
  const query: Record<string, string> = {}
  new URLSearchParams(queryString).forEach((value, key) => {
    query[key] = value
  })
  return query
}

function writeStream(params: {
  response: UwsResponse
  result: Extract<NotificationHttpResult, { kind: 'stream' }>
  isAborted: () => boolean
}): void {
  const { response, result } = params

  response.cork(() => {
    response
      .writeStatus(statusText(200))
      .writeHeader('Content-Type', 'text/event-stream')
      .writeHeader('Cache-Control', 'no-cache, no-transform')
      .writeHeader('X-Accel-Buffering', 'no')
  })

  const emit = (event: SseEvent): void => {
    if (params.isAborted()) return
    response.cork(() => {
      response.write(formatSseChunk(event))
    })
  }

  void result.subscribe(emit).then((subscription) => {
    if (params.isAborted()) {
      subscription.close()
      return
    }

    const heartbeat = setInterval(() => {
      if (params.isAborted()) {
        clearInterval(heartbeat)
        subscription.close()
        return
      }
      response.cork(() => {
        response.write(': heartbeat\n\n')
      })
    }, result.heartbeatSeconds * 1000)
  })
}

function writeResult(params: {
  response: UwsResponse
  result: NotificationHttpResult
  isAborted: () => boolean
}): void {
  const { response, result } = params
  if (params.isAborted()) return

  if (result.kind === 'stream') {
    writeStream({ response, result, isAborted: params.isAborted })
    return
  }

  response.cork(() => {
    response.writeStatus(statusText(result.status))
    for (const [key, value] of Object.entries(result.headers ?? {})) response.writeHeader(key, value)

    if (result.kind === 'empty') {
      response.end()
      return
    }
    response.writeHeader('Content-Type', 'application/json')
    response.end(JSON.stringify(result.body))
  })
}

export function mountNotificationRoutes(params: MountNotificationRoutesParams): void {
  const compiledRoutes: CompiledRoute[] = compileRoutes(params.routes, params.basePath ?? '')
  const normalizedBase = (params.basePath ?? '').endsWith('/')
    ? (params.basePath ?? '').slice(0, -1)
    : (params.basePath ?? '')

  for (const route of params.routes) {
    const uwsPattern = `${normalizedBase}${route.path}`
    const register = {
      GET: params.app.get.bind(params.app),
      POST: params.app.post.bind(params.app),
      PUT: params.app.put.bind(params.app),
      PATCH: params.app.patch.bind(params.app),
      DELETE: params.app.del.bind(params.app),
    }[route.method]

    register(uwsPattern, (response, request) => {
      // Tudo do `req` é lido AGORA, síncrono — depois do primeiro await o objeto é reciclado.
      const method = request.getMethod().toUpperCase()
      const pathname = request.getUrl()
      const query = parseQueryString(request.getQuery())
      const headers: Record<string, string> = {}
      request.forEach((key, value) => {
        headers[key.toLowerCase()] = value
      })

      let aborted = false
      response.onAborted(() => {
        aborted = true
      })
      const isAborted = (): boolean => aborted

      const hasBody = method !== 'GET' && method !== 'DELETE'

      void readRawBody(response, hasBody)
        .then((rawBody) =>
          dispatchRoute({
            compiledRoutes,
            request: { method, pathname, query, headers, rawBody },
            authResolver: params.authResolver,
            logger: params.logger,
          }),
        )
        .then((result) => {
          if (!result) {
            writeResult({
              response,
              result: { kind: 'empty', status: 404 },
              isAborted,
            })
            return
          }
          writeResult({ response, result, isAborted })
        })
        .catch((error: unknown) => {
          params.logger?.error('notification.uws.unhandled_error', { error: String(error) })
          writeResult({ response, result: { kind: 'empty', status: 500 }, isAborted })
        })
    })
  }
}
