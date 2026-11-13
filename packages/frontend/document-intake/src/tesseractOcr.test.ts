import { describe, expect, test } from 'bun:test'

import { createTesseractOcrClient, readsWithOcr } from './tesseractOcr.client'

describe('escolha entre camada de texto e OCR', () => {
  /** PDF tem camada de texto para tentar; imagem não tem. Quem decide é o arquivo, não o documento. */
  test('manda para o OCR tudo que não é PDF', () => {
    expect(readsWithOcr('application/pdf')).toBe(false)
    expect(readsWithOcr('image/png')).toBe(true)
    expect(readsWithOcr('image/jpeg')).toBe(true)
  })
})

describe('cliente do tesseract-server', () => {
  function clientWith(response: Response, calls: Request[] = []) {
    const original = globalThis.fetch
    globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
      calls.push(new Request(typeof input === 'string' ? input : input.toString(), init))
      return response
    }) as typeof fetch
    return { calls, restore: () => (globalThis.fetch = original) }
  }

  test('devolve o stdout do serviço quando a saída é limpa', async () => {
    const body = JSON.stringify({ data: { exit: { code: 0, signal: null }, stderr: '', stdout: 'NOME MARIA' } })
    const fake = clientWith(new Response(body, { status: 200 }))
    try {
      const client = createTesseractOcrClient({ baseUrl: 'http://localhost:8884' })
      const text = await client.extractText({ bytes: new Uint8Array([1, 2]), mimeType: 'image/png' })

      expect(text).toBe('NOME MARIA')
      expect(fake.calls[0]?.url).toBe('http://localhost:8884/tesseract')
    } finally {
      fake.restore()
    }
  })

  /** Saída de erro do Tesseract é "não deu para ler", e quem chama decide o que fazer com isso. */
  test('código de saída diferente de zero vira erro, não texto vazio', async () => {
    const body = JSON.stringify({
      data: { exit: { code: 1, signal: null }, stderr: 'Pdf reading is not supported', stdout: '' },
    })
    const fake = clientWith(new Response(body, { status: 200 }))
    try {
      const client = createTesseractOcrClient({ baseUrl: 'http://localhost:8884' })

      expect(client.extractText({ bytes: new Uint8Array([1]), mimeType: 'application/pdf' })).rejects.toThrow(
        'Pdf reading is not supported',
      )
    } finally {
      fake.restore()
    }
  })

  test('resposta HTTP com falha vira erro com o status', async () => {
    const fake = clientWith(new Response('', { status: 503 }))
    try {
      const client = createTesseractOcrClient({ baseUrl: 'http://localhost:8884' })

      expect(client.extractText({ bytes: new Uint8Array([1]), mimeType: 'image/png' })).rejects.toThrow('503')
    } finally {
      fake.restore()
    }
  })
})
