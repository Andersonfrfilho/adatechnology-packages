/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O que este teste protege: documento cifrado tem de ser ENCONTRÁVEL sem que o valor cru exista em
 * lugar nenhum. As duas metades importam — só cifrar quebraria a busca, só indexar vazaria o dado.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { createHash, createHmac } from 'node:crypto'

import type { DocumentCipherPort, DocumentDefinition } from '@adatechnology/customer-contracts'

const DATABASE_URL = process.env['CUSTOMER_TEST_DATABASE_URL']
const suite = DATABASE_URL ? describe : describe.skip

/**
 * Cifra de teste com NONCE, de propósito: é o que torna o texto cifrado diferente a cada gravação,
 * e é justamente por isso que a impressão precisa existir. Uma cifra determinística no teste
 * esconderia o problema que o índice cego resolve.
 */
const cipher: DocumentCipherPort = {
  async encrypt(plaintext) {
    const nonce = createHash('sha256').update(`${plaintext}${Math.random()}`).digest('hex').slice(0, 8)
    return `${nonce}:${Buffer.from(plaintext).toString('base64')}`
  },
  async decrypt(ciphertext) {
    return Buffer.from(ciphertext.split(':')[1] ?? '', 'base64').toString('utf8')
  },
  async fingerprint(plaintext) {
    return createHmac('sha256', 'chave-de-teste').update(plaintext).digest('hex')
  },
}

const CATALOG: DocumentDefinition[] = [
  { name: 'cpf', label: 'CPF', required: true, validator: 'cpf' },
  { name: 'rg', label: 'RG', required: false, validator: 'none' },
]

suite('documento', () => {
  let pool: import('pg').Pool
  let setDocument: import('./Document.use-case').SetDocumentUseCase
  let findByDocument: import('./Document.use-case').FindByDocumentUseCase
  let db: any
  let schema: typeof import('../schema/schema')

  beforeAll(async () => {
    const { Pool } = await import('pg')
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const { SetDocumentUseCase, FindByDocumentUseCase } = await import('./Document.use-case')
    schema = await import('../schema/schema')

    pool = new Pool({ connectionString: DATABASE_URL })
    db = drizzle({ client: pool })
    const dependencies = { db, cipher, encryptedDocuments: ['cpf'] }
    setDocument = new SetDocumentUseCase(dependencies)
    findByDocument = new FindByDocumentUseCase(dependencies)
  })

  afterAll(async () => {
    await pool?.end()
  })

  beforeEach(async () => {
    await pool.query('truncate "customer"."customers" cascade')
  })

  async function novoCliente(name: string): Promise<string> {
    const [row] = await db.insert(schema.customers).values({ name }).returning({ id: schema.customers.id })
    return row!.id
  }

  it('o CPF em claro NÃO chega ao banco', async () => {
    const id = await novoCliente('Anderson')
    await setDocument.execute({ customerId: id, name: 'cpf', value: '123.456.789-01', catalog: CATALOG })

    const { rows } = await pool.query('select value, fingerprint from "customer"."customer_documents"')
    expect(rows[0].value).not.toContain('12345678901')
    expect(rows[0].value).not.toContain('123.456.789-01')
    expect(rows[0].fingerprint).toHaveLength(64)
  })

  it('...e mesmo assim é encontrável, com ou sem máscara', async () => {
    const id = await novoCliente('Anderson')
    await setDocument.execute({ customerId: id, name: 'cpf', value: '12345678901', catalog: CATALOG })

    expect(await findByDocument.execute({ name: 'cpf', value: '123.456.789-01' })).toBe(id)
    expect(await findByDocument.execute({ name: 'cpf', value: '12345678901' })).toBe(id)
    expect(await findByDocument.execute({ name: 'cpf', value: '99999999999' })).toBeUndefined()
  })

  it('documento NÃO declarado cifrado fica em claro e busca pelo próprio valor', async () => {
    const id = await novoCliente('Anderson')
    await setDocument.execute({ customerId: id, name: 'rg', value: '12.345.678-9', catalog: CATALOG })

    const { rows } = await pool.query(`select value, fingerprint from "customer"."customer_documents" where name='rg'`)
    expect(rows[0].value).toBe('123456789')
    expect(rows[0].fingerprint).toBeNull()
    expect(await findByDocument.execute({ name: 'rg', value: '123456789' })).toBe(id)
  })

  it('regravar o CPF ATUALIZA, em vez de criar uma segunda linha', async () => {
    const id = await novoCliente('Anderson')
    await setDocument.execute({ customerId: id, name: 'cpf', value: '11111111111', catalog: CATALOG })
    await setDocument.execute({ customerId: id, name: 'cpf', value: '22222222222', catalog: CATALOG })

    const { rows } = await pool.query(`select count(*)::int as n from "customer"."customer_documents" where name='cpf'`)
    expect(rows[0].n).toBe(1)
    expect(await findByDocument.execute({ name: 'cpf', value: '22222222222' })).toBe(id)
    expect(await findByDocument.execute({ name: 'cpf', value: '11111111111' })).toBeUndefined()
  })

  it('recusa documento fora do catálogo — nenhuma tela saberia desenhá-lo', async () => {
    const id = await novoCliente('Anderson')

    expect(setDocument.execute({ customerId: id, name: 'passaporte', value: 'X1', catalog: CATALOG })).rejects.toThrow()
  })
})
