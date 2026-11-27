/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { toFetchResponse } from './fetch'

describe('resultado binário', () => {
  it('devolve os bytes como estão, com o Content-Type declarado e os cabeçalhos extras', async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff])
    const response = toFetchResponse(
      {
        kind: 'binary',
        status: 200,
        body: bytes,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: { 'Content-Disposition': 'attachment; filename="leads.xlsx"', 'Content-Type': 'text/plain' },
      },
      new AbortController().signal,
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(response.headers.get('content-disposition')).toContain('leads.xlsx')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  })
})

describe('resultado binário no uWS', () => {
  it('um Content-Type só, o declarado, e os bytes intactos', async () => {
    const { mountModuleRoutes } = await import('./uws')
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    const handlers = new Map<string, (res: import('./uws').UwsResponse, req: import('./uws').UwsRequest) => void>()
    const register = (
      pattern: string,
      handler: (res: import('./uws').UwsResponse, req: import('./uws').UwsRequest) => void,
    ) => {
      handlers.set(pattern, handler)
      return app
    }
    const app = { get: register, post: register, put: register, patch: register, del: register }
    mountModuleRoutes({
      app,
      routes: [
        {
          method: 'GET',
          path: '/file',
          scope: 'public',
          operationId: 'file',
          summary: 'arquivo',
          handler: async () => ({
            kind: 'binary',
            status: 200,
            body: bytes,
            contentType: 'application/zip',
            headers: { 'Content-Type': 'text/plain', 'Content-Disposition': 'attachment' },
          }),
        },
      ],
    })
    const written: [string, string][] = []
    const ended = await new Promise<unknown>((resolve) => {
      const response: import('./uws').UwsResponse = {
        writeStatus: () => response,
        writeHeader(key: string, value: string) {
          written.push([key, value])
          return response
        },
        write: () => true,
        end(value) {
          resolve(value)
          return response
        },
        cork: (callback) => callback(),
        onAborted: () => undefined,
        onData: () => undefined,
      }
      handlers.get('/file')?.(response, {
        getMethod: () => 'get',
        getUrl: () => '/file',
        getQuery: () => '',
        forEach: () => undefined,
      })
    })
    expect(written.filter(([key]) => key.toLowerCase() === 'content-type')).toEqual([
      ['Content-Type', 'application/zip'],
    ])
    expect(written).toContainEqual(['Content-Disposition', 'attachment'])
    expect(ended).toEqual(bytes)
  })
})

describe('IP do cliente no adaptador fetch', () => {
  it('`handle(request, { ip })` chega à rota em `context.ip`', async () => {
    const { createModuleFetchRouter } = await import('./fetch')
    const router = createModuleFetchRouter({
      routes: [
        {
          method: 'GET',
          path: '/ip',
          scope: 'public',
          operationId: 'ip',
          summary: 'ip',
          handler: async (context) => ({ kind: 'json', status: 200, body: { ip: context.ip ?? null } }),
        },
      ],
    })
    const withIp = await router.handle(new Request('http://localhost/ip'), { ip: '203.0.113.7' })
    expect(await withIp.json()).toEqual({ ip: '203.0.113.7' })
    expect(await (await router.handle(new Request('http://localhost/ip'))).json()).toEqual({ ip: null })
  })
})
