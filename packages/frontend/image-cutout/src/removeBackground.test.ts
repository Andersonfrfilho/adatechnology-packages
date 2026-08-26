/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { BACKGROUND_FILL, toWebpName } from './removeBackground'

describe('toWebpName', () => {
  it('troca a extensao, porque a saida sempre sai em webp', () => {
    expect(toWebpName('retrato.png')).toBe('retrato-sem-fundo.webp')
    expect(toWebpName('foto.JPEG')).toBe('foto-sem-fundo.webp')
  })

  it('so a ultima extensao cai — ponto no meio do nome nao e extensao', () => {
    expect(toWebpName('ana.maria.souza.png')).toBe('ana.maria.souza-sem-fundo.webp')
  })

  it('nome sem extensao continua sendo um nome', () => {
    expect(toWebpName('retrato')).toBe('retrato-sem-fundo.webp')
  })

  it('nome vazio nao vira um arquivo comecando por hifen', () => {
    expect(toWebpName('.png')).toBe('imagem-sem-fundo.webp')
    expect(toWebpName('')).toBe('imagem-sem-fundo.webp')
  })
})

describe('BACKGROUND_FILL', () => {
  it('o branco e o padrao documentado: transparente some no tema escuro de quem recebe', () => {
    expect(BACKGROUND_FILL.WHITE).toBe('white')
    expect(BACKGROUND_FILL.TRANSPARENT).toBe('transparent')
  })
})
