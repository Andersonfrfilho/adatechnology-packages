/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Cadastro pelo PAINEL. O que este arquivo protege é o conflito de número: ele apareceu como 500
 * genérico no primeiro produto que adotou o pacote, e "Erro interno" não diz ao operador que o
 * número que ele digitou é de outra pessoa.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'

import { WhatsAppPhoneTakenError, type CustomerSettings } from '@adatechnology/customer-contracts'

const DATABASE_URL = process.env['CUSTOMER_TEST_DATABASE_URL']
const suite = DATABASE_URL ? describe : describe.skip

const settings: CustomerSettings = {
  maskPhoneInList: true,
  documentCatalog: [],
  fieldCatalog: [{ name: 'apelido', label: 'Apelido', type: 'text', required: false }],
  updatedAt: new Date(),
}

suite('cadastro pelo painel', () => {
  let pool: import('pg').Pool
  let create: import('./Customer.use-case').CreateCustomerUseCase

  beforeAll(async () => {
    const { Pool } = await import('pg')
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const { CreateCustomerUseCase } = await import('./Customer.use-case')
    const { SetDocumentUseCase } = await import('./Document.use-case')
    const { CustomerRepository } = await import('../repositories/CustomerRepository')

    pool = new Pool({ connectionString: DATABASE_URL })
    const db = drizzle({ client: pool })
    create = new CreateCustomerUseCase({
      db,
      repository: new CustomerRepository(db),
      setDocument: new SetDocumentUseCase({ db, encryptedDocuments: [] }),
      defaultCountryCode: '55',
      encryptedDocuments: [],
    })
  })

  afterAll(async () => {
    await pool?.end()
  })

  beforeEach(async () => {
    await pool.query('truncate "customer"."customers" cascade')
  })

  it('número de WhatsApp que já tem dono é CONFLITO, não erro interno', async () => {
    await create.execute({
      input: {
        name: 'Anderson',
        phones: [{ number: '(16) 99305-6772', isWhatsApp: true }],
        addresses: [],
        documents: [],
        attributes: {},
      },
      settings,
    })

    // Reler e devolver o cliente existente juntaria duas pessoas numa ficha só. Aqui é conflito.
    expect(
      create.execute({
        input: {
          name: 'Outra Pessoa',
          phones: [{ number: '5516993056772', isWhatsApp: true }],
          addresses: [],
          documents: [],
          attributes: {},
        },
        settings,
      }),
    ).rejects.toBeInstanceOf(WhatsAppPhoneTakenError)
  })

  it('a ficha recusada não deixa cliente órfão — a transação inteira volta atrás', async () => {
    await create.execute({
      input: {
        name: 'Anderson',
        phones: [{ number: '5516993056772', isWhatsApp: true }],
        addresses: [],
        documents: [],
        attributes: {},
      },
      settings,
    })

    await create
      .execute({
        input: {
          name: 'Outra Pessoa',
          phones: [{ number: '5516993056772', isWhatsApp: true }],
          addresses: [],
          documents: [],
          attributes: {},
        },
        settings,
      })
      .catch(() => undefined)

    const { rows } = await pool.query('select count(*)::int as n from "customer"."customers"')
    expect(rows[0].n).toBe(1)
  })

  it('o MESMO número sem WhatsApp em outro cliente é permitido — a casa da família tem um telefone só', async () => {
    await create.execute({
      input: {
        name: 'Anderson',
        phones: [{ number: '1633056772', isWhatsApp: true }],
        addresses: [],
        documents: [],
        attributes: {},
      },
      settings,
    })

    const outro = await create.execute({
      input: {
        name: 'Maria',
        phones: [{ number: '1633056772', isWhatsApp: false }],
        addresses: [],
        documents: [],
        attributes: {},
      },
      settings,
    })

    expect(outro).toBeTruthy()
  })

  it('atributo fora do catálogo é recusado ANTES de abrir transação', async () => {
    await create
      .execute({
        input: { name: 'Anderson', phones: [], addresses: [], documents: [], attributes: { renda: 10 } },
        settings,
      })
      .catch(() => undefined)

    const { rows } = await pool.query('select count(*)::int as n from "customer"."customers"')
    expect(rows[0].n).toBe(0)
  })
})
