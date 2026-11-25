import { describe, expect, it } from 'bun:test'

import { InteractiveLimitExceededError, META_WHATSAPP_ERROR_CODES } from './errors'
import {
  assertInteractiveWithinLimits,
  listInteractiveLimitViolations,
  type InteractiveListMessage,
} from './interactive'

function row(id: string, title = `Opção ${id}`, description?: string) {
  return { id, title, ...(description !== undefined ? { description } : {}) }
}

function list(overrides: Partial<InteractiveListMessage> = {}): InteractiveListMessage {
  return {
    kind: 'list',
    body: 'Escolha uma opção',
    buttonLabel: 'Ver opções',
    sections: [{ rows: [row('a'), row('b')] }],
    ...overrides,
  }
}

describe('listInteractiveLimitViolations — botões', () => {
  it('aceita até 3 botões dentro do teto', () => {
    expect(
      listInteractiveLimitViolations({
        kind: 'buttons',
        body: 'Confirma?',
        buttons: [
          { id: 'sim', title: '✅ Sim' },
          { id: 'nao', title: '🔙 Não' },
        ],
      }),
    ).toEqual([])
  })

  it('aponta quarto botão, título longo e id repetido — tudo de uma vez', () => {
    const violations = listInteractiveLimitViolations({
      kind: 'buttons',
      body: 'Escolha',
      buttons: [
        { id: 'a', title: 'x'.repeat(21) },
        { id: 'a', title: 'B' },
        { id: 'c', title: 'C' },
        { id: 'd', title: 'D' },
      ],
    })
    expect(violations).toContainEqual({ path: 'buttons', rule: 'max-count', limit: 3, actual: 4 })
    expect(violations).toContainEqual({ path: 'buttons[0].title', rule: 'max-length', limit: 20, actual: 21 })
    expect(violations).toContainEqual({ path: 'buttons[1].id', rule: 'duplicate-id' })
  })

  it('emoji conta como um caractere, não como duas unidades UTF-16', () => {
    const title = `🙋${'a'.repeat(19)}`
    expect(title.length).toBe(21)
    expect(listInteractiveLimitViolations({ kind: 'buttons', body: 'b', buttons: [{ id: 'x', title }] })).toEqual([])
  })

  it('corpo vazio e lista de botões vazia são violações', () => {
    const violations = listInteractiveLimitViolations({ kind: 'buttons', body: '  ', buttons: [] })
    expect(violations).toContainEqual({ path: 'body', rule: 'required' })
    expect(violations).toContainEqual({ path: 'buttons', rule: 'min-count', limit: 1, actual: 0 })
  })
})

describe('listInteractiveLimitViolations — lista', () => {
  it('aceita seção única sem título e linha com descrição de 72 caracteres', () => {
    expect(listInteractiveLimitViolations(list({ sections: [{ rows: [row('a', 'A', 'd'.repeat(72))] }] }))).toEqual([])
  })

  it('aponta descrição acima de 72, título de linha acima de 24 e rótulo do botão acima de 20', () => {
    const violations = listInteractiveLimitViolations(
      list({ buttonLabel: 'r'.repeat(21), sections: [{ rows: [row('a', 't'.repeat(25), 'd'.repeat(73))] }] }),
    )
    expect(violations).toEqual([
      { path: 'buttonLabel', rule: 'max-length', limit: 20, actual: 21 },
      { path: 'sections[0].rows[0].title', rule: 'max-length', limit: 24, actual: 25 },
      { path: 'sections[0].rows[0].description', rule: 'max-length', limit: 72, actual: 73 },
    ])
  })

  it('conta as linhas somando todas as seções', () => {
    const rows = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, index) => row(`${prefix}${index}`))
    const violations = listInteractiveLimitViolations(
      list({
        sections: [
          { title: 'Um', rows: rows('a', 6) },
          { title: 'Dois', rows: rows('b', 5) },
        ],
      }),
    )
    expect(violations).toEqual([{ path: 'rows', rule: 'max-count', limit: 10, actual: 11 }])
  })

  it('exige título de seção quando há mais de uma', () => {
    const violations = listInteractiveLimitViolations(
      list({ sections: [{ rows: [row('a')] }, { title: 'B', rows: [row('b')] }] }),
    )
    expect(violations).toEqual([{ path: 'sections[0].title', rule: 'required' }])
  })

  it('id de linha repetido entre seções é violação — a resposta do cliente ficaria ambígua', () => {
    const violations = listInteractiveLimitViolations(
      list({
        sections: [
          { title: 'A', rows: [row('x')] },
          { title: 'B', rows: [row('x')] },
        ],
      }),
    )
    expect(violations).toEqual([{ path: 'sections[1].rows[0].id', rule: 'duplicate-id' }])
  })
})

describe('assertInteractiveWithinLimits', () => {
  it('lança erro tipado com todas as violações', () => {
    try {
      assertInteractiveWithinLimits(list({ buttonLabel: '' }))
      throw new Error('deveria ter lançado')
    } catch (error) {
      expect(error).toBeInstanceOf(InteractiveLimitExceededError)
      const typed = error as InteractiveLimitExceededError
      expect(typed.code).toBe(META_WHATSAPP_ERROR_CODES.INTERACTIVE_LIMIT_EXCEEDED)
      expect(typed.statusCode).toBe(422)
      expect(typed.violations).toEqual([{ path: 'buttonLabel', rule: 'required' }])
    }
  })

  it('não lança para mensagem válida', () => {
    expect(() => assertInteractiveWithinLimits(list())).not.toThrow()
  })
})
