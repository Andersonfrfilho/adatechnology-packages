/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A garantia mais importante do módulo, verificada no BANCO e não na declaração.
 *
 * A declaração em `schema.ts` é incompleta de propósito: `NULLS NOT DISTINCT` não se expressa no
 * DSL do Drizzle para índice parcial, e vive só na migration. Sem este teste, alguém regenerando a
 * migration a partir do schema perderia a cláusula — e o índice continuaria existindo, parecendo
 * certo, sem impedir nada. Foi assim que o defeito apareceu na primeira execução.
 *
 * O que está em jogo: se dois clientes dividirem o número do WhatsApp, a próxima mensagem cai na
 * ficha errada. Sem erro nenhum — só resposta para a pessoa errada.
 *
 * Precisa de Postgres. `DATABASE_URL` ausente pula, em vez de falhar: teste de integração que
 * quebra a suíte de quem não tem banco vira teste que se desliga.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

const DATABASE_URL = process.env['CUSTOMER_TEST_DATABASE_URL']
const suite = DATABASE_URL ? describe : describe.skip

suite('unicidade do telefone de WhatsApp', () => {
  let pool: import('pg').Pool
  let db: ReturnType<typeof import('drizzle-orm/node-postgres').drizzle>
  let schema: typeof import('./schema/schema')

  beforeAll(async () => {
    const { Pool } = await import('pg')
    const { drizzle } = await import('drizzle-orm/node-postgres')
    schema = await import('./schema/schema')
    pool = new Pool({ connectionString: DATABASE_URL })
    db = drizzle({ client: pool })
    await pool.query('truncate "customer"."customers" cascade')
  })

  afterAll(async () => {
    await pool?.end()
  })

  /** O construtor do Drizzle é *thenable*, não Promise — `expect(...).rejects` não o entende. */
  async function recusa(executar: () => Promise<unknown>): Promise<boolean> {
    try {
      await executar()
      return false
    } catch {
      return true
    }
  }

  async function novoCliente(name: string): Promise<string> {
    const [row] = await db.insert(schema.customers).values({ name }).returning({ id: schema.customers.id })
    return row!.id
  }

  it('recusa o MESMO número de WhatsApp em dois clientes, com company_id nulo', async () => {
    const numero = '5516900000001'
    await db.insert(schema.customerPhones).values({ customerId: await novoCliente('A'), number: numero, isWhatsApp: true })

    const outro = await novoCliente('B')

    // Se isto virar `false`, o índice perdeu o `NULLS NOT DISTINCT` — ver o cabeçalho.
    expect(
      await recusa(() => db.insert(schema.customerPhones).values({ customerId: outro, number: numero, isWhatsApp: true })),
    ).toBe(true)
  })

  it('PERMITE o mesmo número comum em dois clientes — só o do WhatsApp é exclusivo', async () => {
    const numero = '551133330000'
    await db.insert(schema.customerPhones).values({ customerId: await novoCliente('C'), number: numero })
    await db.insert(schema.customerPhones).values({ customerId: await novoCliente('D'), number: numero })

    const { rows } = await pool.query('select count(*)::int as n from "customer"."customer_phones" where number = $1', [numero])
    expect(rows[0].n).toBe(2)
  })

  it('separa por empresa: o mesmo WhatsApp pode ser cliente de duas', async () => {
    const numero = '5516900000002'
    const [a] = await db.insert(schema.customers).values({ name: 'E', companyId: crypto.randomUUID() }).returning()
    const [b] = await db.insert(schema.customers).values({ name: 'F', companyId: crypto.randomUUID() }).returning()

    await db.insert(schema.customerPhones).values({ customerId: a!.id, companyId: a!.companyId, number: numero, isWhatsApp: true })
    await db.insert(schema.customerPhones).values({ customerId: b!.id, companyId: b!.companyId, number: numero, isWhatsApp: true })

    const { rows } = await pool.query('select count(*)::int as n from "customer"."customer_phones" where number = $1', [numero])
    expect(rows[0].n).toBe(2)
  })

  it('a instalação tem UMA configuração: a segunda com company_id nulo é recusada', async () => {
    await pool.query('truncate "customer"."settings"')
    await db.insert(schema.customerSettings).values({})

    expect(await recusa(() => db.insert(schema.customerSettings).values({}))).toBe(true)
  })
})
