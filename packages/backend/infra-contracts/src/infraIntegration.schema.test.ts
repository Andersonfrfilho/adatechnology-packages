/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { infraIntegrationRemoveBodySchema, infraIntegrationSaveBodySchema } from './infraIntegration.schema'

const VALID = { token: 'ISCA-TOKEN-0123456789', password: 'senha-inventada-123' }

describe('infraIntegrationSaveBodySchema', () => {
  it('aceita token e senha validos', () => {
    expect(infraIntegrationSaveBodySchema.parse(VALID)).toEqual(VALID)
  })

  it('recusa qualquer chave extra, inclusive workspaceId', () => {
    expect(infraIntegrationSaveBodySchema.safeParse({ ...VALID, workspaceId: 'w-1' }).success).toBe(false)
    expect(infraIntegrationSaveBodySchema.safeParse({ ...VALID, other: 1 }).success).toBe(false)
  })

  it('recusa token curto, longo, com espaco ou caractere fora do alfabeto', () => {
    for (const token of ['curto', 'x'.repeat(129), 'ISCA TOKEN 0123456789', 'ISCA-TOKEN-0123456789!']) {
      expect(infraIntegrationSaveBodySchema.safeParse({ ...VALID, token }).success).toBe(false)
    }
  })

  it('recusa senha vazia ou acima de 200', () => {
    expect(infraIntegrationSaveBodySchema.safeParse({ ...VALID, password: '' }).success).toBe(false)
    expect(infraIntegrationSaveBodySchema.safeParse({ ...VALID, password: 'x'.repeat(201) }).success).toBe(false)
  })

  it('nenhuma mensagem de erro contem o valor recebido', () => {
    const result = infraIntegrationSaveBodySchema.safeParse({
      token: 'ISCA token com espaco',
      password: 1,
      extra: 'SEGREDO-EXTRA',
    })
    const serialized = JSON.stringify(result.success ? {} : result.error.issues.map((issue) => issue.message))
    expect(serialized).not.toContain('ISCA token com espaco')
    expect(serialized).not.toContain('SEGREDO-EXTRA')
  })
})

describe('infraIntegrationRemoveBodySchema', () => {
  it('aceita so a senha e recusa chave extra', () => {
    expect(infraIntegrationRemoveBodySchema.parse({ password: 'x' })).toEqual({ password: 'x' })
    expect(infraIntegrationRemoveBodySchema.safeParse({ password: 'x', token: VALID.token }).success).toBe(false)
  })
})
