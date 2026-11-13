/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { VisionError } from './product-vision.error'
import type { ProductVisionEngine, VisionReading } from './product-vision.types'
import { createVisionChain } from './vision-chain.service'

const IMAGE = { buffer: Buffer.from([1, 2, 3]), mimeType: 'image/jpeg' }

function engine(name: string, reading: Omit<VisionReading, 'engine'>): ProductVisionEngine {
  return { name, read: async () => ({ ...reading, engine: name }) }
}

function failing(name: string, retriable = false): ProductVisionEngine {
  return {
    name,
    read: async () => {
      throw new VisionError(`${name} caiu`, name, retriable)
    },
  }
}

describe('a cadeia funde, nao escolhe', () => {
  it('soma o codigo de barras de um engine com o vetor de outro', async () => {
    const chain = createVisionChain([engine('zbar', { barcode: '789' }), engine('clip', { embedding: [0.1, 0.2] })])

    expect(await chain.read(IMAGE)).toEqual({ barcode: '789', embedding: [0.1, 0.2], engine: 'zbar+clip' })
  })

  it('nao para no codigo de barras — e o vetor que salva o produto sem GTIN cadastrado', async () => {
    // Se a cadeia parasse aqui, o consumidor cairia para a busca vetorial num vetor inexistente,
    // justamente no caso em que o codigo foi lido mas ninguem preencheu o GTIN do item.
    const chain = createVisionChain([engine('zbar', { barcode: '789' }), engine('clip', { embedding: [0.5] })])

    expect((await chain.read(IMAGE)).embedding).toEqual([0.5])
  })

  it('a ordem da cadeia e a prioridade: o primeiro a preencher o campo ganha', async () => {
    const chain = createVisionChain([engine('primeiro', { barcode: '111' }), engine('segundo', { barcode: '222' })])

    expect((await chain.read(IMAGE)).barcode).toBe('111')
  })
})

describe('degradacao', () => {
  it('um engine vivo basta, e a leitura parcial vale', async () => {
    const failures: string[] = []
    const chain = createVisionChain([failing('clip'), engine('zbar', { barcode: '789' })], {
      onEngineFailure: (_error, details) => failures.push(details.engine),
    })

    expect(await chain.read(IMAGE)).toEqual({ barcode: '789', engine: 'zbar' })
    // A queda precisa ser observavel: sem o aviso, a busca visual fica fora por uma semana e a
    // leitura continua voltando com o codigo de barras, como se estivesse tudo bem.
    expect(failures).toEqual(['clip'])
  })

  it('nenhum engine de pe e falha, nao "nada encontrado"', async () => {
    const chain = createVisionChain([failing('zbar'), failing('clip')])

    await expect(chain.read(IMAGE)).rejects.toThrow('caiu')
  })

  it('propaga o erro retriavel na frente do definitivo', async () => {
    // O consumidor decide tentar de novo a partir disto; propagar o definitivo faria uma queda
    // temporaria de infraestrutura virar desistencia.
    const chain = createVisionChain([failing('definitivo', false), failing('temporario', true)])

    await expect(chain.read(IMAGE)).rejects.toThrow('temporario caiu')
  })

  it('leitura vazia nao e falha', async () => {
    // Foto sem codigo visivel de algo que a loja nao vende: o engine respondeu, so nao viu nada.
    const chain = createVisionChain([engine('zbar', {}), engine('clip', {})])

    expect(await chain.read(IMAGE)).toEqual({ engine: 'zbar+clip' })
  })
})

describe('modelo de embedding da cadeia', () => {
  it('herda o do primeiro engine que tem um', () => {
    const clip: ProductVisionEngine = {
      name: 'clip',
      embeddingModel: { id: 'clip-vit-b32', dimensions: 512 },
      read: async () => ({ engine: 'clip' }),
    }
    const chain = createVisionChain([engine('zbar', {}), clip])

    expect(chain.embeddingModel).toEqual({ id: 'clip-vit-b32', dimensions: 512 })
  })

  it('cadeia so de codigo de barras nao declara modelo, e o indice vetorial nao sobe', () => {
    const chain = createVisionChain([engine('zbar', {}), engine('outro-zbar', {})])

    expect(chain.embeddingModel).toBeUndefined()
  })

  it('um engine so volta ele mesmo, sem envelope', () => {
    const single = engine('zbar', {})

    expect(createVisionChain([single])).toBe(single)
  })

  it('cadeia vazia e erro de composicao', () => {
    expect(() => createVisionChain([])).toThrow('A cadeia precisa de pelo menos um engine.')
  })
})
