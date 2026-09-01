/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Teste contra o transformers.js DE VERDADE, com inferencia real.
 *
 * Existe pelo mesmo motivo do teste de integracao do leitor de codigo de barras: os testes com
 * duble aprovaram uma forma de chamar a biblioteca que nao existia. Aqui a imagem era passada como
 * `data:` URL, e o transformers TENTA BUSCAR a URL que recebe — toda foto voltava como
 * "404 Not Found", num erro que nao lembra em nada a causa.
 *
 * Pulado quando as peers opcionais nao estao instaladas. Baixa ~90MB de pesos na primeira execucao.
 */

import { describe, expect, it } from 'bun:test'

import { CLIP_DEFAULT_DIMENSIONS } from '../product-vision.constant'
import { createClipEmbedder } from './clip-embedder.service'

const transformers = await import('@huggingface/transformers').catch(() => undefined)
const sharpModule = await import('sharp').catch(() => undefined)
const podeRodar = Boolean(transformers && sharpModule)

async function pngSolido(r: number, g: number, b: number): Promise<Buffer> {
  const sharp = (sharpModule as { default: (options: unknown) => { png(): { toBuffer(): Promise<Buffer> } } }).default
  return sharp({ create: { width: 64, height: 64, channels: 3, background: { r, g, b } } })
    .png()
    .toBuffer()
}

describe.if(podeRodar)('CLIP de verdade', () => {
  it('devolve vetor na dimensao que o indice do consumidor espera', async () => {
    const embedder = createClipEmbedder()

    const reading = await embedder.read({ buffer: await pngSolido(200, 30, 30), mimeType: 'image/png' })

    // 512 nao e chute: e o que o `catalog-module` declara na coluna `vector(512)`, e divergir
    // derruba o boot de la.
    expect(reading.embedding).toHaveLength(CLIP_DEFAULT_DIMENSIONS)
    expect(reading.engine).toBe('clip')
  }, 300_000)

  it('imagens diferentes produzem vetores diferentes', async () => {
    // Sem isto, um `read` que devolvesse sempre o mesmo vetor passaria no teste acima — e a busca
    // por similaridade responderia o mesmo produto para qualquer foto.
    const embedder = createClipEmbedder()

    const vermelho = await embedder.read({ buffer: await pngSolido(220, 20, 20), mimeType: 'image/png' })
    const azul = await embedder.read({ buffer: await pngSolido(20, 20, 220), mimeType: 'image/png' })

    expect(vermelho.embedding).not.toEqual(azul.embedding)
  }, 300_000)

  it('o vetor sai normalizado, que e o que a distancia de cosseno pressupoe', async () => {
    const embedder = createClipEmbedder()

    const { embedding } = await embedder.read({ buffer: await pngSolido(120, 120, 120), mimeType: 'image/png' })
    const norma = Math.sqrt((embedding ?? []).reduce((soma, valor) => soma + valor * valor, 0))

    expect(norma).toBeCloseTo(1, 3)
  }, 300_000)
})
