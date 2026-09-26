/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * As duas economias que sobraram depois de medir, e que o duble consegue afirmar porque sao
 * decisao nossa: manter o modelo carregado e encolher a foto antes de enviar.
 *
 * Os NUMEROS que motivam as duas estao no README e vieram de medicao contra o Ollama real —
 * `1280px` custa 1632 tokens de visao e ~6,6s; `896px` cai para 1104 e ~4,2s; abaixo disso nao
 * muda nada, porque o modelo normaliza.
 */

import { describe, expect, it } from 'bun:test'

import { OLLAMA_DEFAULT_KEEP_ALIVE, OLLAMA_DEFAULT_MAX_IMAGE_WIDTH } from '../product-vision.constant'
import { createOllamaRanker } from './ollama-ranker.service'

const IMAGE = { buffer: Buffer.from([1, 2, 3]), mimeType: 'image/jpeg' }
const CANDIDATOS = [
  { productId: 'p-1', name: 'Leite Integral' },
  { productId: 'p-2', name: 'Leite Desnatado' },
]

describe('manter o modelo na memoria', () => {
  it('pede keep_alive em toda chamada', async () => {
    // Medido: modelo frio ~16s, quente ~4s. O default do Ollama (5 min) faz um desempate
    // esporadico pagar o carregamento quase sempre.
    const pedidos: { keep_alive?: string }[] = []
    const ranker = createOllamaRanker({
      fetchImplementation: async (_url, init) => {
        pedidos.push(JSON.parse(String(init.body)))
        return new Response(JSON.stringify({ message: { content: '1' } }))
      },
    })

    await ranker.rank({ image: IMAGE, candidates: CANDIDATOS })

    expect(pedidos[0]?.keep_alive).toBe(OLLAMA_DEFAULT_KEEP_ALIVE)
  })
})

describe('encolher a foto antes de enviar', () => {
  it('usa a imagem preparada, nao a original', async () => {
    const enviados: { messages: { images: string[] }[] }[] = []
    const menor = { buffer: Buffer.from([9, 9]), mimeType: 'image/jpeg' }
    let larguraPedida = 0

    const ranker = createOllamaRanker({
      prepareImage: async (_input, maxWidth) => {
        larguraPedida = maxWidth
        return menor
      },
      fetchImplementation: async (_url, init) => {
        enviados.push(JSON.parse(String(init.body)))
        return new Response(JSON.stringify({ message: { content: '1' } }))
      },
    })

    await ranker.rank({ image: IMAGE, candidates: CANDIDATOS })

    expect(enviados[0]?.messages[0]?.images[0]).toBe(menor.buffer.toString('base64'))
    expect(larguraPedida).toBe(OLLAMA_DEFAULT_MAX_IMAGE_WIDTH)
  })

  it('sem a porta, manda a foto como veio', async () => {
    // Degrada em custo, nunca em funcionamento: o pacote nao carrega decodificador de imagem por
    // ninguem, entao a otimizacao depende de o host plugar a sua.
    const enviados: { messages: { images: string[] }[] }[] = []
    const ranker = createOllamaRanker({
      fetchImplementation: async (_url, init) => {
        enviados.push(JSON.parse(String(init.body)))
        return new Response(JSON.stringify({ message: { content: '1' } }))
      },
    })

    await ranker.rank({ image: IMAGE, candidates: CANDIDATOS })

    expect(enviados[0]?.messages[0]?.images[0]).toBe(IMAGE.buffer.toString('base64'))
  })
})
