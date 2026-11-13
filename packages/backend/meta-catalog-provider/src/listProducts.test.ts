import { describe, expect, test, afterEach } from 'bun:test'

import { MetaCatalogProvider } from './MetaCatalogProvider'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

type StubbedResponse = {
  readonly data: ReadonlyArray<{ id: string; retailer_id: string; name?: string }>
  readonly paging?: { next?: string }
}

function stubGraph(responses: readonly StubbedResponse[]): { requestedUrls: string[] } {
  const requestedUrls: string[] = []
  let call = 0

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrls.push(String(input))
    const body = responses[Math.min(call, responses.length - 1)]
    call += 1
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch

  return { requestedUrls }
}

function buildProvider(): MetaCatalogProvider {
  return new MetaCatalogProvider({
    accessToken: 'test-token',
    apiVersion: 'v21.0',
    catalogId: '1234567890',
  })
}

describe('listProducts', () => {
  test('mapeia retailer_id para retailerId', async () => {
    stubGraph([{ data: [{ id: '1', retailer_id: 'financiamento-habitacional', name: 'Financiamento' }] }])

    const products = await buildProvider().listProducts()

    expect(products).toEqual([{ id: '1', retailerId: 'financiamento-habitacional', name: 'Financiamento' }])
  })

  test('segue a paginação até a última página', async () => {
    const { requestedUrls } = stubGraph([
      { data: [{ id: '1', retailer_id: 'a' }], paging: { next: 'https://graph.facebook.com/next-page' } },
      { data: [{ id: '2', retailer_id: 'b' }] },
    ])

    const products = await buildProvider().listProducts()

    expect(products.map((product) => product.retailerId)).toEqual(['a', 'b'])
    expect(requestedUrls[1]).toBe('https://graph.facebook.com/next-page')
  })

  // Sem o teto, um `paging.next` sempre presente transformaria a checagem de tela num laço infinito.
  test('para no teto de páginas mesmo com paginação sem fim', async () => {
    const { requestedUrls } = stubGraph([
      { data: [{ id: '1', retailer_id: 'a' }], paging: { next: 'https://graph.facebook.com/loop' } },
    ])

    await buildProvider().listProducts()

    expect(requestedUrls.length).toBe(20)
  })

  test('consulta o catálogo informado em vez do configurado', async () => {
    const { requestedUrls } = stubGraph([{ data: [] }])

    await buildProvider().listProducts({ catalogId: '9999' })

    expect(requestedUrls[0]).toContain('/9999/products')
  })
})
