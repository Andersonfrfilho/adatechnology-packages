/**
 * Guarda a classificação de falha do simulador do cliente.
 *
 * O defeito que motivou o arquivo: o `refresh` tratava QUALQUER erro ao ler o transcript como
 * "conversa ainda não existe", mostrava thread vazia e não dizia nada. Com sessão ausente (401) o
 * sintoma era o pior possível — a mensagem ia para o webhook, era aceita, e a tela ficava igual.
 * Quem olhava concluía que o envio estava quebrado.
 */

import { describe, expect, it } from 'bun:test'

import { describeLoadFailure, isNotFound } from './ConversationPreview'

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

describe('isNotFound', () => {
  // Primeiro contato: a conversa não existe e transcript vazio é o estado correto, sem alarme.
  it('reconhece 404 como conversa inexistente', () => {
    expect(isNotFound(new HttpError('Conversa não encontrada', 404))).toBe(true)
  })

  it('não confunde 401 com conversa inexistente', () => {
    expect(isNotFound(new HttpError('Unauthorized', 401))).toBe(false)
  })

  it('erro sem status não é tratado como inexistente', () => {
    expect(isNotFound(new Error('Failed to fetch'))).toBe(false)
    expect(isNotFound(undefined)).toBe(false)
  })

  // Aceita `statusCode` também: nem todo host nomeia o campo igual.
  it('lê statusCode quando é esse o nome do campo', () => {
    expect(isNotFound({ statusCode: 404 })).toBe(true)
  })
})

describe('describeLoadFailure', () => {
  it('explica que falta sessão e que a mensagem FOI entregue', () => {
    const mensagem = describeLoadFailure(new HttpError('Unauthorized', 401))

    expect(mensagem).toContain('Sem sessão')
    // O ponto central: não deixar o operador achar que o envio falhou.
    expect(mensagem).toContain('entregue no webhook')
  })

  it('trata 403 igual a 401', () => {
    expect(describeLoadFailure(new HttpError('Forbidden', 403))).toContain('Sem sessão')
  })

  it('preserva a mensagem do host em falha genérica', () => {
    expect(describeLoadFailure(new HttpError('API fora do ar', 500))).toContain('API fora do ar')
  })

  it('tem texto para erro sem mensagem', () => {
    expect(describeLoadFailure({}).length).toBeGreaterThan(0)
  })
})
