/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { toErrorResult } from './errorFilter'

describe('erro de domínio', () => {
  it('`details` fica no servidor; só `publicDetails` vai para a resposta', () => {
    const error = Object.assign(new Error('Confira os dados.'), {
      statusCode: 400,
      code: 'X_INVALID',
      details: { userId: 'u-1' },
      publicDetails: { fields: [{ field: 'email', message: 'Valor inválido.' }] },
    })
    const result = toErrorResult({ error })
    expect(result.status).toBe(400)
    expect(result.body).toEqual({
      error: {
        code: 'X_INVALID',
        message: 'Confira os dados.',
        issues: undefined,
        details: { fields: [{ field: 'email', message: 'Valor inválido.' }] },
      },
    })
    expect(JSON.stringify(result.body)).not.toContain('u-1')
  })

  it('sem `publicDetails`, a resposta não ganha `details`', () => {
    const result = toErrorResult({
      error: Object.assign(new Error('x'), { statusCode: 404, code: 'X_NOT_FOUND', details: { id: '1' } }),
    })
    expect(result.body).toEqual({ error: { code: 'X_NOT_FOUND', message: 'x', issues: undefined } })
  })
})
