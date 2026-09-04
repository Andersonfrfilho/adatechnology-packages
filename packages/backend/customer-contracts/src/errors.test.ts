/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O filtro do `module-http` reconhece erro de domínio pela FORMA, não por herança. Um erro sem
 * `statusCode` não é reconhecido e vira 500 — foi o que aconteceu: o número de WhatsApp já usado
 * respondia "Erro interno", e a ficha inexistente também.
 *
 * Este arquivo afirma a forma, e não só o status: é a forma que o filtro exige, e é ela que some
 * quando alguém acrescenta um erro novo sem pensar nisso.
 */

import { describe, expect, it } from 'bun:test'

import {
  CUSTOMER_ERROR_CODE,
  CustomerError,
  CustomerNotFoundError,
  EncryptedFieldRemovalError,
  FieldNameImmutableError,
  FieldTypeImmutableError,
  InvalidFieldValueError,
  LastWhatsAppPhoneError,
  UnknownFieldError,
  WhatsAppPhoneTakenError,
} from './errors'

/** A mesma checagem que o `module-http` faz. Copiada de propósito: se ela mudar lá, quebra aqui. */
function isDomainErrorShape(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { statusCode?: unknown; code?: unknown; message?: unknown }
  return (
    typeof candidate.statusCode === 'number' &&
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string'
  )
}

const TODOS = [
  new CustomerNotFoundError(),
  new WhatsAppPhoneTakenError(),
  new LastWhatsAppPhoneError(),
  new UnknownFieldError('renda'),
  new InvalidFieldValueError('renda', 'x'),
  new FieldNameImmutableError('renda'),
  new FieldTypeImmutableError('renda'),
  new EncryptedFieldRemovalError('renda'),
]

describe('forma do erro de domínio', () => {
  it('TODO erro do pacote é reconhecível pelo filtro — sem isto, vira 500', () => {
    const invisiveis = TODOS.filter((error) => !isDomainErrorShape(error)).map((error) => error.name)

    expect(invisiveis).toEqual([])
  })

  it('nenhum erro cai em statusCode indefinido — código sem entrada na tabela é NaN silencioso', () => {
    for (const code of Object.values(CUSTOMER_ERROR_CODE)) {
      const error = new CustomerError('teste', code)

      expect(typeof error.statusCode).toBe('number')
      expect(Number.isFinite(error.statusCode)).toBe(true)
    }
  })
})

describe('status por situação', () => {
  it('ficha que não existe é 404', () => {
    expect(new CustomerNotFoundError().statusCode).toBe(404)
  })

  it('número já usado é 409 e NÃO 400 — o pedido está bem formado, o banco é que impede', () => {
    expect(new WhatsAppPhoneTakenError().statusCode).toBe(409)
  })

  it('campo fora do catálogo é 400 — o corpo em si está errado', () => {
    expect(new UnknownFieldError('renda').statusCode).toBe(400)
    expect(new InvalidFieldValueError('renda', 'x').statusCode).toBe(400)
  })

  it('recusa da REGRA sobre corpo válido é 422', () => {
    expect(new LastWhatsAppPhoneError().statusCode).toBe(422)
    expect(new FieldTypeImmutableError('renda').statusCode).toBe(422)
    expect(new EncryptedFieldRemovalError('renda').statusCode).toBe(422)
  })

  it('erro de composição do host é 500 — quem precisa ver é o log, não o cliente', () => {
    expect(new CustomerError('x', CUSTOMER_ERROR_CODE.CONFIG_MISSING).statusCode).toBe(500)
  })
})
