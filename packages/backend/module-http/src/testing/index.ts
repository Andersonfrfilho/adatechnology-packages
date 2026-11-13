/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Dublê do uWebSockets.js para o teste de contrato do módulo consumidor rodar sem o addon.
 * Reproduz só o que o adaptador usa: registro por método, `cork`, `onAborted` e `onData`.
 */

import type { UwsApp, UwsRequest, UwsResponse } from '../uws'

export type UwsHarness = {
  readonly app: UwsApp
  call(params: {
    method: string
    path: string
    headers?: Record<string, string>
    body?: unknown
  }): Promise<{ status: number; body: unknown }>
}

export function createUwsHarness(): UwsHarness {
  const handlers = new Map<string, (res: UwsResponse, req: UwsRequest) => void>()

  const register =
    (method: string) =>
    (pattern: string, handler: (res: UwsResponse, req: UwsRequest) => void): UwsApp => {
      handlers.set(`${method} ${pattern}`, handler)
      return app
    }

  const app: UwsApp = {
    get: register('GET'),
    post: register('POST'),
    put: register('PUT'),
    patch: register('PATCH'),
    del: register('DELETE'),
  }

  return {
    app,
    call({ method, path, headers, body }) {
      return new Promise((resolve) => {
        const [pathname, queryString = ''] = path.split('?')
        const entry = [...handlers.entries()].find(([key]) => {
          const [registeredMethod, pattern] = key.split(' ')
          if (registeredMethod !== method) return false
          return new RegExp(`^${(pattern ?? '').replace(/:[A-Za-z0-9_]+/g, '[^/]+')}$`).test(pathname ?? '')
        })

        if (!entry) {
          resolve({ status: 404, body: undefined })
          return
        }

        let status = 0
        let dataCallback: ((chunk: ArrayBuffer, isLast: boolean) => void) | undefined

        const response: UwsResponse = {
          writeStatus(value) {
            status = Number.parseInt(value, 10)
            return response
          },
          writeHeader: () => response,
          write: () => true,
          end(value) {
            resolve({ status, body: value === undefined || value === '' ? undefined : JSON.parse(value) })
            return response
          },
          cork: (callback) => callback(),
          onAborted: () => {},
          onData: (callback) => {
            dataCallback = callback
          },
        }

        const request: UwsRequest = {
          getMethod: () => method.toLowerCase(),
          getUrl: () => pathname ?? '',
          getQuery: () => queryString,
          forEach: (callback) => {
            for (const [key, value] of Object.entries(headers ?? {})) callback(key.toLowerCase(), value)
          },
        }

        entry[1](response, request)

        // O uWS entrega o corpo por `onData` depois que o handler registra o callback.
        if (dataCallback) {
          const encoded = new TextEncoder().encode(body === undefined ? '' : JSON.stringify(body))
          dataCallback(encoded.buffer as ArrayBuffer, true)
        }
      })
    },
  }
}
