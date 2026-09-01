/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createBarcodeReader } from './barcode-reader.service'

const JPEG = { buffer: Buffer.from([1, 2, 3]), mimeType: 'image/jpeg' }
const fakeImage = {} as ImageData

function readerWith(symbols: { typeName: string; value: string }[], formats?: readonly string[]) {
  return createBarcodeReader(formats ? { formats } : {}, {
    loadZbar: async () => ({
      scanImageData: async () => symbols.map((s) => ({ typeName: s.typeName, decode: () => s.value })),
    }),
    decodeImage: async () => fakeImage,
  })
}

describe('leitura de codigo de barras', () => {
  it('devolve o EAN-13 encontrado', async () => {
    const reading = await readerWith([{ typeName: 'EAN-13', value: '7891000100103' }]).read(JPEG)

    expect(reading).toEqual({ barcode: '7891000100103', engine: 'zbar' })
  })

  it('QR Code na gondola nao vira codigo de produto', async () => {
    // Prateleira tem QR de promocao colado ao lado do preco, e o cliente fotografa tudo junto.
    const reading = await readerWith([{ typeName: 'QR-Code', value: 'https://promo.exemplo' }]).read(JPEG)

    expect(reading).toEqual({ engine: 'zbar' })
  })

  it('simbolo sem digito nao passa por GTIN', async () => {
    // CODE-128 carrega texto livre. Entregar isso a uma busca por chave exata gastaria a consulta
    // e responderia "nao encontrado" em vez de deixar a cascata seguir para o vetor.
    const reading = await readerWith([{ typeName: 'CODE-128', value: 'LOTE-ABC-2026' }]).read(JPEG)

    expect(reading).toEqual({ engine: 'zbar' })
  })

  it('imagem sem codigo devolve leitura vazia, nao erro', async () => {
    expect(await readerWith([]).read(JPEG)).toEqual({ engine: 'zbar' })
  })

  it('mime nao suportado nao contribui, e nao derruba a cadeia', async () => {
    const reading = await readerWith([{ typeName: 'EAN-13', value: '7891000100103' }]).read({
      ...JPEG,
      mimeType: 'image/svg+xml',
    })

    expect(reading).toEqual({ engine: 'zbar' })
  })

  it('o engine nao declara modelo de embedding', () => {
    // E o que permite a cadeia so-de-codigo servir a um catalogo sem foto nenhuma.
    expect(readerWith([]).embeddingModel).toBeUndefined()
  })
})
