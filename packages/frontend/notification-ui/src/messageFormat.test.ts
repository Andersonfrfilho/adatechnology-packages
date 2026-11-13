import { describe, expect, it } from 'bun:test'

import { applyMark, insertAt } from './messageFormat.util'

function bold(text: string, selectionStart: number, selectionEnd: number) {
  return applyMark({ text, delimiter: '*', selectionStart, selectionEnd })
}

describe('applyMark', () => {
  it('envolve a selecao', () => {
    expect(bold('ola mundo', 4, 9).text).toBe('ola *mundo*')
  })

  it('mantem a selecao no texto, nao nos delimitadores', () => {
    const result = bold('ola mundo', 4, 9)

    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('mundo')
  })

  /** `**x**` vira literal na conversa: a convencao do WhatsApp nao aninha. */
  it('alterna em vez de acumular: dois cliques devolvem o original', () => {
    const once = bold('ola mundo', 4, 9)
    const twice = applyMark({
      text: once.text,
      delimiter: '*',
      selectionStart: once.selectionStart,
      selectionEnd: once.selectionEnd,
    })

    expect(twice.text).toBe('ola mundo')
  })

  it('desfaz tambem quando a selecao inclui os delimitadores', () => {
    expect(bold('ola *mundo*', 4, 11).text).toBe('ola mundo')
  })

  it('selecao vazia insere o par com o cursor no meio', () => {
    const result = bold('ola ', 4, 4)

    expect(result.text).toBe('ola **')
    expect(result.selectionStart).toBe(5)
    expect(result.selectionEnd).toBe(5)
  })

  it('delimitador de mais de um caractere tambem alterna', () => {
    const once = applyMark({ text: 'codigo', delimiter: '```', selectionStart: 0, selectionEnd: 6 })
    const twice = applyMark({
      text: once.text,
      delimiter: '```',
      selectionStart: once.selectionStart,
      selectionEnd: once.selectionEnd,
    })

    expect(once.text).toBe('```codigo```')
    expect(twice.text).toBe('codigo')
  })

  it('indice fora do texto nao quebra nem perde caractere', () => {
    expect(bold('abc', -5, 999).text).toBe('*abc*')
  })
})

describe('insertAt', () => {
  it('insere no cursor e deixa o cursor depois do inserido', () => {
    const result = insertAt({ text: 'ola ', insertion: '👋', selectionStart: 4, selectionEnd: 4 })

    expect(result.text).toBe('ola 👋')
    expect(result.selectionStart).toBe(result.text.length)
  })

  it('substitui o que estava selecionado', () => {
    expect(insertAt({ text: 'ola mundo', insertion: '✅', selectionStart: 4, selectionEnd: 9 }).text).toBe('ola ✅')
  })
})
