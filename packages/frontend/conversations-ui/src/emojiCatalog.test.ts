import { describe, expect, it } from 'bun:test'
import { EMOJI_CATEGORIES, searchEmojis } from './emojiCatalog'

describe('searchEmojis', () => {
  it('devolve o catálogo inteiro quando não há termo', () => {
    const total = EMOJI_CATEGORIES.reduce((sum, category) => sum + category.entries.length, 0)
    expect(searchEmojis('').length).toBe(total)
    expect(searchEmojis('   ').length).toBe(total)
  })

  it('acha pela palavra sem acento e com acento', () => {
    const semAcento = searchEmojis('coracao').map((entry) => entry.emoji)
    const comAcento = searchEmojis('coração').map((entry) => entry.emoji)

    expect(semAcento).toContain('❤️')
    expect(comAcento).toContain('❤️')
  })

  it('ignora caixa e casa por prefixo, não pelo meio da palavra', () => {
    expect(searchEmojis('CASA').map((entry) => entry.emoji)).toContain('🏠')
    // "sa" está dentro de "casa", mas não é prefixo de nenhuma palavra-chave dela.
    expect(searchEmojis('sa').map((entry) => entry.emoji)).not.toContain('🏠')
  })

  it('atravessa categorias, não só a aberta', () => {
    const resultados = searchEmojis('pagamento').map((entry) => entry.emoji)

    expect(resultados).toContain('💳')
    expect(resultados.length).toBeGreaterThan(1)
  })

  it('devolve vazio quando nada casa, em vez de cair no catálogo inteiro', () => {
    expect(searchEmojis('xyzabc')).toEqual([])
  })
})
