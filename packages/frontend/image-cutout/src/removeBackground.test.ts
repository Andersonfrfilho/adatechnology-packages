/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { BACKGROUND_FILL, isBackgroundColorFill, resolveBackgroundColor, toWebpName } from './removeBackground'

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

/**
 * A cor do fundo existe porque "branco ou transparente" não cobre foto de perfil: um avatar
 * recortado sobre branco numa tela escura vira um selo branco, e sobre transparente ele se dissolve
 * no que estiver atrás. Quem hospeda escolhe — normalmente a cor da marca.
 */
describe('cor de fundo', () => {
  it('a palavra continua valendo, e o branco continua sendo branco', () => {
    expect(resolveBackgroundColor(BACKGROUND_FILL.WHITE)).toBe('#ffffff')
  })

  it('transparente não pinta nada', () => {
    expect(resolveBackgroundColor(BACKGROUND_FILL.TRANSPARENT)).toBeNull()
  })

  it('a cor da empresa entra como hexadecimal, com ou sem atalho de tres digitos', () => {
    expect(resolveBackgroundColor({ color: '#0b3d2e' })).toBe('#0b3d2e')
    expect(resolveBackgroundColor({ color: ' #FFF ' })).toBe('#FFF')
  })

  /**
   * `fillStyle` aceita qualquer string e **ignora em silêncio** a que não entende: sem esta guarda,
   * uma cor errada sairia como fundo transparente, sem erro, e a falha apareceria semanas depois
   * como "às vezes o recorte fica sem fundo".
   */
  it('cor que o canvas ignoraria em silencio vira erro na chamada', () => {
    expect(() => resolveBackgroundColor({ color: 'rebeccapurple' })).toThrow(/hexadecimal/u)
    expect(() => resolveBackgroundColor({ color: 'var(--color-brand)' })).toThrow(/hexadecimal/u)
    expect(() => resolveBackgroundColor({ color: '#12345' })).toThrow(/hexadecimal/u)
    expect(() => resolveBackgroundColor({ color: '' })).toThrow(/hexadecimal/u)
  })

  it('a palavra e a cor sao distinguiveis sem adivinhar', () => {
    expect(isBackgroundColorFill(BACKGROUND_FILL.WHITE)).toBe(false)
    expect(isBackgroundColorFill({ color: '#0b3d2e' })).toBe(true)
  })
})
