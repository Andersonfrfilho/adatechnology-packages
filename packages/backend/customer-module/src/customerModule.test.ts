/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createCustomerModule } from './CustomerModule'

const db = {} as never
const tenancy = { mode: 'single' } as const

describe('composição do módulo', () => {
  it('declarar documento cifrado SEM cifra falha no boot, não em produção', () => {
    expect(() => createCustomerModule({ db, config: { tenancy, encryptedDocuments: ['cpf'] } })).toThrow(/cpf/)
  })

  it('sem documento cifrado, a cifra é opcional', () => {
    expect(() => createCustomerModule({ db, config: { tenancy } })).not.toThrow()
  })
})
