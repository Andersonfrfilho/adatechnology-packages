/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { CLIP_DEFAULT_DIMENSIONS } from '../product-vision.constant'
import { createClipEmbedder } from './clip-embedder.service'

const JPEG = { buffer: Buffer.from([1, 2, 3]), mimeType: 'image/jpeg' }
const vector = (length: number) => Array.from({ length }, (_value, index) => index / length)

describe('embedding de imagem', () => {
  it('devolve o vetor na dimensao do indice', async () => {
    const embedder = createClipEmbedder(
      {},
      { loadExtractor: async () => async () => ({ data: vector(512) }), toImage: async () => ({}) },
    )

    const reading = await embedder.read(JPEG)

    expect(reading.embedding).toHaveLength(CLIP_DEFAULT_DIMENSIONS)
    expect(reading.engine).toBe('clip')
  })

  it('vetor de dimensao inesperada falha em vez de envenenar o indice', async () => {
    // A coluna do consumidor tem tamanho fixo; deixar passar adiaria o erro para o INSERT, no meio
    // de uma conversa, e um vetor de outro modelo responde produto errado com toda a confianca.
    const embedder = createClipEmbedder(
      {},
      { loadExtractor: async () => async () => ({ data: vector(768) }), toImage: async () => ({}) },
    )

    await expect(embedder.read(JPEG)).rejects.toThrow('768 dimensoes')
  })

  it('carrega o modelo uma vez, nao por foto', async () => {
    let loads = 0
    const embedder = createClipEmbedder(
      {},
      {
        loadExtractor: async () => {
          loads += 1
          return async () => ({ data: vector(512) })
        },
        toImage: async () => ({}),
      },
    )

    await embedder.read(JPEG)
    await embedder.read(JPEG)

    expect(loads).toBe(1)
  })

  it('declara o modelo, que e o que o indice do consumidor guarda', () => {
    const embedder = createClipEmbedder({ model: 'Xenova/clip-vit-base-patch32' })

    expect(embedder.embeddingModel).toEqual({ id: 'Xenova/clip-vit-base-patch32', dimensions: 512 })
  })

  it('inferencia que passa do timeout e retriavel', async () => {
    const embedder = createClipEmbedder(
      { timeoutMs: 10 },
      { loadExtractor: async () => () => new Promise(() => undefined), toImage: async () => ({}) },
    )

    await expect(embedder.read(JPEG)).rejects.toThrow('passou de 10ms')
  })
})
