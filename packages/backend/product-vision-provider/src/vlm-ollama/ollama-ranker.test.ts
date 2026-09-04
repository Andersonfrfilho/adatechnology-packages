/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Estes dublês cobrem o que e DECISAO NOSSA — o formato do pedido, a leitura da resposta e o que
 * fazer com cada uma delas. A forma de falar com o Ollama tem teste de integracao separado, porque
 * duble sobre API de terceiro so confirma a propria invencao (foi assim que o zbar e o CLIP saíram
 * quebrados).
 */

import { describe, expect, it } from 'bun:test'

import { createOllamaRanker } from './ollama-ranker.service'

const IMAGE = { buffer: Buffer.from([1, 2, 3]), mimeType: 'image/jpeg' }
const CANDIDATOS = [
  { productId: 'p-1', name: 'Leite Integral 1L' },
  { productId: 'p-2', name: 'Leite Desnatado 1L' },
  { productId: 'p-3', name: 'Leite Semidesnatado 1L' },
]

function rankerRespondendo(content: string, status = 200) {
  const pedidos: unknown[] = []
  const ranker = createOllamaRanker({
    fetchImplementation: async (_url: string, init: RequestInit) => {
      pedidos.push(JSON.parse(String(init.body)))
      return new Response(JSON.stringify({ message: { content } }), { status })
    },
  })
  return { ranker, pedidos }
}

describe('a escolha do modelo', () => {
  it('numero da opcao vira o produto correspondente', async () => {
    const { ranker } = rankerRespondendo('2')

    expect(await ranker.rank({ image: IMAGE, candidates: CANDIDATOS })).toEqual({
      productId: 'p-2',
      engine: 'ollama',
    })
  })

  it('aceita resposta com texto em volta do numero', async () => {
    // O modelo responde "3" quando pedido, mas tambem "A opcao 3." — exigir resposta limpa
    // desperdicaria acerto.
    const { ranker } = rankerRespondendo('A opção 3 é o produto da foto.')

    expect((await ranker.rank({ image: IMAGE, candidates: CANDIDATOS })).productId).toBe('p-3')
  })

  it('zero significa "nenhum destes", e nao vira escolha', async () => {
    const { ranker } = rankerRespondendo('0')

    expect(await ranker.rank({ image: IMAGE, candidates: CANDIDATOS })).toEqual({ engine: 'ollama' })
  })

  it('numero fora da faixa nao vira escolha', async () => {
    // Chutar o primeiro candidato apresentaria uma alucinacao como sugestao.
    const { ranker } = rankerRespondendo('7')

    expect(await ranker.rank({ image: IMAGE, candidates: CANDIDATOS })).toEqual({ engine: 'ollama' })
  })

  it('resposta sem numero nenhum nao vira escolha', async () => {
    const { ranker } = rankerRespondendo('Nao consigo identificar.')

    expect(await ranker.rank({ image: IMAGE, candidates: CANDIDATOS })).toEqual({ engine: 'ollama' })
  })
})

describe('o que nem chega ao modelo', () => {
  it('um candidato so dispensa o desempate', async () => {
    // Gastar a inferencia para "confirmar" o unico item transformaria o degrau mais caro da
    // cascata no mais frequente.
    const { ranker, pedidos } = rankerRespondendo('1')

    const resultado = await ranker.rank({ image: IMAGE, candidates: [CANDIDATOS[0]!] })

    expect(resultado).toEqual({ productId: 'p-1', engine: 'ollama' })
    expect(pedidos).toHaveLength(0)
  })

  it('mime nao suportado nao gasta inferencia', async () => {
    const { ranker, pedidos } = rankerRespondendo('1')

    const resultado = await ranker.rank({
      image: { ...IMAGE, mimeType: 'image/svg+xml' },
      candidates: CANDIDATOS,
    })

    expect(resultado).toEqual({ engine: 'ollama' })
    expect(pedidos).toHaveLength(0)
  })
})

describe('o pedido enviado', () => {
  it('numera as opcoes e pede numero, nunca o id do produto', async () => {
    // Pedir UUID convida alucinacao: o modelo inventa um id parecido, o consumidor nao acha na
    // lista e a escolha se perde.
    const { ranker, pedidos } = rankerRespondendo('1')

    await ranker.rank({ image: IMAGE, candidates: CANDIDATOS })

    const enviado = pedidos[0] as { messages: { content: string; images: string[] }[] }
    expect(enviado.messages[0]?.content).toContain('1. Leite Integral 1L')
    expect(enviado.messages[0]?.content).not.toContain('p-1')
    expect(enviado.messages[0]?.images).toHaveLength(1)
  })

  it('temperatura zero: a pergunta tem resposta certa', async () => {
    const { ranker, pedidos } = rankerRespondendo('1')

    await ranker.rank({ image: IMAGE, candidates: CANDIDATOS })

    expect((pedidos[0] as { options: { temperature: number } }).options.temperature).toBe(0)
  })
})

describe('falha do servidor', () => {
  it('5xx e retriavel — o Ollama pode ter caido', async () => {
    const { ranker } = rankerRespondendo('', 503)

    await expect(ranker.rank({ image: IMAGE, candidates: CANDIDATOS })).rejects.toMatchObject({
      retriable: true,
    })
  })

  it('4xx nao e: modelo ausente ou payload invalido nao melhora repetindo', async () => {
    const { ranker } = rankerRespondendo('', 404)

    await expect(ranker.rank({ image: IMAGE, candidates: CANDIDATOS })).rejects.toMatchObject({
      retriable: false,
    })
  })
})
