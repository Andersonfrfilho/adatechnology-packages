/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Teste contra um Ollama DE VERDADE. Pulado quando nao ha servidor em pe ou o modelo nao esta
 * baixado — nao e teste que roda em CI sem preparo.
 *
 * Existe porque o duble nao teria pego o que este teste pegou: o `moondream`, primeira escolha de
 * default por ser o menor, devolve string VAZIA no Ollama 0.32 ate com prompt so de texto. Nenhum
 * teste com resposta simulada revelaria isso.
 */

import { describe, expect, it } from 'bun:test'

import { OLLAMA_DEFAULT_BASE_URL, OLLAMA_DEFAULT_MODEL } from '../product-vision.constant'
import { createOllamaRanker } from './ollama-ranker.service'

const sharpModule = await import('sharp').catch(() => undefined)

const modeloDisponivel = await fetch(`${OLLAMA_DEFAULT_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(2000) })
  .then(async (resposta) => {
    const corpo = (await resposta.json()) as { models?: { name: string }[] }
    return Boolean(corpo.models?.some((modelo) => modelo.name.startsWith(OLLAMA_DEFAULT_MODEL.split(':')[0]!)))
  })
  .catch(() => false)

const podeRodar = Boolean(sharpModule) && modeloDisponivel

async function foto(texto: string, cor: string): Promise<Buffer> {
  const sharp = (sharpModule as { default: (input: Buffer) => { jpeg(): { toBuffer(): Promise<Buffer> } } }).default
  const svg = `<svg width="320" height="240"><rect width="320" height="240" fill="${cor}"/><text x="160" y="135" font-size="48" text-anchor="middle" fill="black" font-family="sans-serif">${texto}</text></svg>`
  return sharp(Buffer.from(svg)).jpeg().toBuffer()
}

const CANDIDATOS = [
  { productId: 'p-banana', name: 'Banana' },
  { productId: 'p-morango', name: 'Morango' },
  { productId: 'p-abacaxi', name: 'Abacaxi' },
]

describe.if(podeRodar)('desempate com Ollama de verdade', () => {
  it('escolhe o candidato que corresponde a foto', async () => {
    const ranker = createOllamaRanker()

    const resultado = await ranker.rank({
      image: { buffer: await foto('BANANA', '#fadc3c'), mimeType: 'image/jpeg' },
      candidates: CANDIDATOS,
    })

    expect(resultado.productId).toBe('p-banana')
  }, 120_000)

  it('recusa quando a foto nao e nenhum dos candidatos', async () => {
    // O caso que mais importa: sem a recusa, o desempate escolhe o menos improvavel e a conversa
    // confirma um produto que o cliente nao pediu.
    const ranker = createOllamaRanker()

    const resultado = await ranker.rank({
      image: { buffer: await foto('PARAFUSO', '#888888'), mimeType: 'image/jpeg' },
      candidates: CANDIDATOS,
    })

    expect(resultado.productId).toBeUndefined()
  }, 120_000)

  it('o modelo default responde de verdade', async () => {
    // `moondream` passava neste teste com string vazia interpretada como "nao escolheu" — e por
    // isso a asserção e sobre o servidor responder conteudo, nao sobre a escolha.
    const resposta = await fetch(`${OLLAMA_DEFAULT_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_DEFAULT_MODEL,
        stream: false,
        messages: [{ role: 'user', content: 'Responda apenas: 7' }],
      }),
    })
    const corpo = (await resposta.json()) as { message?: { content?: string } }

    expect((corpo.message?.content ?? '').trim().length).toBeGreaterThan(0)
  }, 120_000)
})
