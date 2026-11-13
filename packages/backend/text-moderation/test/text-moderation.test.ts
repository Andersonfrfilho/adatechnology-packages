/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createTextModerator, parseTermList } from '../src/index'

const moderator = createTextModerator({ isEnabled: true })

describe('createTextModerator', () => {
  // Estes nomes são o motivo do pacote existir: a blocklist por substring do roteador de
  // financiamento rejeita todos eles hoje, e Paulo/Paula/Cunha não são casos de borda.
  const LEGITIMATE_NAMES = [
    'Paulo Silva',
    'Paula Souza',
    'Ana Cunha',
    'Marcus Curi',
    'Rolando Alves',
    'Pauline Costa',
    'Joao Paulino',
    'Maria Bicharra',
    'Lucas Cunegundes',
    'José Antônio Gonçalves',
    'Conceição Rocha',
  ]

  for (const name of LEGITIMATE_NAMES) {
    it(`não acusa o nome legítimo "${name}"`, () => {
      expect(moderator.inspect(name).isOffensive).toBe(false)
    })
  }

  // Regressão do dicionário `pt` da lib, que trazia `no`, `o quê` e `boa sorte` como ofensivos e
  // acusava 4 destas 5 frases. Se alguém reintroduzir aquela lista, estes testes caem.
  const INNOCUOUS_TEXTS = [
    'quero 2kg de arroz no mercado',
    'coloca no carrinho por favor',
    'o que tem no pedido?',
    'boa sorte com a entrega',
    'pode trocar o óleo por azeite?',
    'meus amigos vão adorar o bolo',
    'tem osso para o cachorro?',
    'preciso de pau de canela e um pinto inteiro',
  ]

  for (const text of INNOCUOUS_TEXTS) {
    it(`não acusa a frase comum "${text}"`, () => {
      expect(moderator.inspect(text).isOffensive).toBe(false)
    })
  }

  const OFFENSIVE_TEXTS = ['caralho', 'vai tomar no cu', 'seu merda', 'filho da puta', 'porra nenhuma']

  for (const text of OFFENSIVE_TEXTS) {
    it(`acusa "${text}"`, () => {
      expect(moderator.inspect(text).isOffensive).toBe(true)
    })
  }

  // Acentuados e siglas: dependem de `unicodeWordBoundaries`, senão escapam pelo ç/á.
  const ACCENTED_TEXTS = ['seu viado', 'otario', 'otário', 'desgraça', 'arrombado', 'babaca', 'FDP', 'corno manso']

  for (const text of ACCENTED_TEXTS) {
    it(`acusa "${text}"`, () => {
      expect(moderator.inspect(text).isOffensive).toBe(true)
    })
  }

  it('devolve os termos que casaram, para log e etiqueta', () => {
    const verdict = moderator.inspect('seu babaca, vai tomar no cu')

    expect(verdict.isOffensive).toBe(true)
    expect(verdict.matchedTerms).toContain('babaca')
    expect(verdict.matchedTerms).toContain('cu')
  })

  it('não repete o mesmo termo quando ele aparece duas vezes', () => {
    const verdict = moderator.inspect('babaca, muito babaca')

    expect(verdict.matchedTerms).toEqual(['babaca'])
  })

  it('aceita termos extras do produto', () => {
    const withExtra = createTextModerator({ isEnabled: true, extraTerms: ['jabuticaba'] })

    expect(withExtra.inspect('sua jabuticaba').isOffensive).toBe(true)
    expect(moderator.inspect('sua jabuticaba').isOffensive).toBe(false)
  })

  it('resgata falso positivo por allowedTerms', () => {
    const permissive = createTextModerator({ isEnabled: true, allowedTerms: ['bosta'] })

    expect(permissive.inspect('bosta').isOffensive).toBe(false)
  })

  it('desligado, nunca acusa e não altera o texto', () => {
    const disabled = createTextModerator({ isEnabled: false })

    expect(disabled.inspect('caralho').isOffensive).toBe(false)
    expect(disabled.inspect('caralho').matchedTerms).toEqual([])
    expect(disabled.censor('caralho')).toBe('caralho')
  })

  it('censura para exibição sem tocar no original', () => {
    const original = 'seu babaca'
    const censored = moderator.censor(original)

    expect(censored).not.toBe(original)
    expect(censored).not.toContain('babaca')
    expect(original).toBe('seu babaca')
  })
})

describe('parseTermList', () => {
  it('lê a lista da variável de ambiente normalizando espaço e caixa', () => {
    expect(parseTermList(' Termo1, TERMO2 ,termo3 ')).toEqual(['termo1', 'termo2', 'termo3'])
  })

  it('devolve vazio para ausente ou string vazia', () => {
    expect(parseTermList(undefined)).toEqual([])
    expect(parseTermList('')).toEqual([])
    expect(parseTermList(' , , ')).toEqual([])
  })
})
