/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O caminho quente, contra Postgres real. Pula sem `CUSTOMER_TEST_DATABASE_URL`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'

const DATABASE_URL = process.env['CUSTOMER_TEST_DATABASE_URL']
const suite = DATABASE_URL ? describe : describe.skip

suite('upsertByPhone', () => {
  let pool: import('pg').Pool
  let useCase: import('./UpsertByPhone.use-case').UpsertByPhoneUseCase
  let repository: import('../repositories/CustomerRepository').CustomerRepository

  beforeAll(async () => {
    const { Pool } = await import('pg')
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const { CustomerRepository } = await import('../repositories/CustomerRepository')
    const { UpsertByPhoneUseCase } = await import('./UpsertByPhone.use-case')

    pool = new Pool({ connectionString: DATABASE_URL })
    const db = drizzle({ client: pool })
    repository = new CustomerRepository(db)
    useCase = new UpsertByPhoneUseCase(db, repository, '55')
  })

  afterAll(async () => {
    await pool?.end()
  })

  beforeEach(async () => {
    await pool.query('truncate "customer"."customers" cascade')
  })

  it('cria cliente e telefone de WhatsApp na primeira mensagem', async () => {
    const cliente = await useCase.execute({ number: '(16) 99305-6772', name: 'Anderson' })

    expect(cliente.name).toBe('Anderson')

    const { rows } = await pool.query('select number, is_whatsapp, is_primary from "customer"."customer_phones"')
    expect(rows).toEqual([{ number: '5516993056772', is_whatsapp: true, is_primary: true }])
  })

  it('normaliza: com e sem máscara é a MESMA pessoa, não dois cadastros', async () => {
    const primeiro = await useCase.execute({ number: '5516993056772' })
    const segundo = await useCase.execute({ number: '(16) 99305-6772' })

    expect(segundo.id).toBe(primeiro.id)
  })

  it('não sobrescreve o nome já gravado com o que o canal mandar depois', async () => {
    await useCase.execute({ number: '5516993056772', name: 'Anderson Fernandes' })
    const segundo = await useCase.execute({ number: '5516993056772', name: 'Anderson' })

    expect(segundo.name).toBe('Anderson Fernandes')
  })

  it('duas mensagens SIMULTÂNEAS do mesmo número criam UM cliente', async () => {
    /*
     * É o caso comum, não o raro: a pessoa manda "oi" e o nome em seguida, e os dois webhooks
     * correm. Sem o tratamento da corrida, o segundo estouraria no índice único e a mensagem do
     * cliente sumiria.
     */
    const [a, b] = await Promise.all([
      useCase.execute({ number: '5516993056772' }),
      useCase.execute({ number: '5516993056772' }),
    ])

    expect(a.id).toBe(b.id)

    const { rows } = await pool.query('select count(*)::int as n from "customer"."customers"')
    expect(rows[0].n).toBe(1)
  })

  it('a busca acha por nome e por telefone, com ou sem máscara', async () => {
    await useCase.execute({ number: '5516993056772', name: 'Anderson Fernandes' })
    await useCase.execute({ number: '5511988887777', name: 'Amanda' })

    for (const termo of ['ander', 'Fernandes', '99305', '(16) 99305-6772']) {
      const { rows } = await repository.list({ companyId: undefined, page: 1, perPage: 10, search: termo })
      expect(rows.map((r) => r.name)).toEqual(['Anderson Fernandes'])
    }
  })

  it('a busca não engasga com curinga do SQL: `%` é texto, não "qualquer coisa"', async () => {
    await useCase.execute({ number: '5516993056772', name: 'Anderson' })

    const { total } = await repository.list({ companyId: undefined, page: 1, perPage: 10, search: '%' })
    expect(total).toBe(0)
  })
})
