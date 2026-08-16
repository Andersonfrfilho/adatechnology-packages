/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { WhatsAppConfigError, WhatsAppRejectionError } from '@adatechnology/meta-graph-core'

import { MetaCatalogProvider } from './MetaCatalogProvider'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function buildProvider(): MetaCatalogProvider {
  return new MetaCatalogProvider({
    accessToken: 'fixture-token',
    catalogId: 'catalog-1',
    wabaId: 'waba-1',
    businessId: 'business-1',
  })
}

function mockFetchOnce(body: unknown, status = 200): { requestUrl: string; requestInit: RequestInit }[] {
  const calls: { requestUrl: string; requestInit: RequestInit }[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ requestUrl: String(input), requestInit: init ?? {} })
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  return calls
}

describe('MetaCatalogProvider.createProduct', () => {
  test('posts to the resolved catalog products endpoint with default availability and condition', async () => {
    const calls = mockFetchOnce({ id: 'product-1' })
    const provider = buildProvider()

    const result = await provider.createProduct({
      retailerId: 'sku-1',
      name: 'Produto',
      description: 'Descrição',
      priceInCents: 1000,
      currency: 'BRL',
      imageUrl: 'https://example.com/image.png',
      categoryLabel: 'categoria',
    })

    expect(result).toEqual({ id: 'product-1' })
    expect(calls).toHaveLength(1)
    const [{ requestUrl, requestInit }] = calls
    expect(requestUrl).toBe('https://graph.facebook.com/v21.0/catalog-1/products')
    expect(requestInit.method).toBe('POST')
    const payload = JSON.parse(String(requestInit.body))
    expect(payload).toMatchObject({
      retailer_id: 'sku-1',
      availability: 'in stock',
      condition: 'new',
    })
  })

  test('throws WhatsAppConfigError when no catalogId is configured', async () => {
    const provider = new MetaCatalogProvider({ accessToken: 'fixture-token' })

    await expect(
      provider.createProduct({
        retailerId: 'sku-1',
        name: 'Produto',
        description: 'Descrição',
        priceInCents: 1000,
        currency: 'BRL',
        imageUrl: 'https://example.com/image.png',
        categoryLabel: 'categoria',
      }),
    ).rejects.toBeInstanceOf(WhatsAppConfigError)
  })
})

describe('MetaCatalogProvider.getProduct', () => {
  test('maps the Graph API response into the provider result shape', async () => {
    mockFetchOnce({
      id: 'product-1',
      retailer_id: 'sku-1',
      name: 'Produto',
      description: 'Descrição',
      price: 1000,
      currency: 'BRL',
      image_url: 'https://example.com/image.png',
      availability: 'in stock',
      condition: 'new',
      url: 'https://example.com/product',
    })
    const provider = buildProvider()

    const result = await provider.getProduct('product-1')

    expect(result).toEqual({
      id: 'product-1',
      retailerId: 'sku-1',
      name: 'Produto',
      description: 'Descrição',
      priceInCents: 1000,
      currency: 'BRL',
      imageUrl: 'https://example.com/image.png',
      categoryLabel: '',
      availability: 'in stock',
      condition: 'new',
      url: 'https://example.com/product',
    })
  })

  test('rejects with WhatsAppRejectionError when the Graph API responds with an error', async () => {
    mockFetchOnce({ error: { code: 100, message: 'Invalid parameter' } }, 400)
    const provider = buildProvider()

    await expect(provider.getProduct('product-1')).rejects.toBeInstanceOf(WhatsAppRejectionError)
  })
})

describe('MetaCatalogProvider.listCatalogs', () => {
  test('lists catalogs under the configured business account', async () => {
    const calls = mockFetchOnce({ data: [{ id: 'catalog-1', name: 'Catálogo' }] })
    const provider = buildProvider()

    const result = await provider.listCatalogs()

    expect(result).toEqual([{ id: 'catalog-1', name: 'Catálogo' }])
    const [{ requestUrl }] = calls
    expect(requestUrl.startsWith('https://graph.facebook.com/v21.0/waba-1/product_catalogs')).toBe(true)
  })
})

describe('MetaCatalogProvider.deleteProduct', () => {
  test('sends a DELETE request to the product endpoint', async () => {
    const calls = mockFetchOnce({ success: true })
    const provider = buildProvider()

    await provider.deleteProduct('product-1')

    expect(calls).toHaveLength(1)
    const [{ requestUrl, requestInit }] = calls
    expect(requestUrl).toBe('https://graph.facebook.com/v21.0/product-1')
    expect(requestInit.method).toBe('DELETE')
  })
})
