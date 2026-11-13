/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O primário exclusivo NÃO tem constraint no banco (seria índice único parcial por cliente, e a
 * promoção automática na remoção viveria fora dele de qualquer jeito). Sem constraint, é teste que
 * segura — e por isso ele existe.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'

const DATABASE_URL = process.env['CUSTOMER_TEST_DATABASE_URL']
const suite = DATABASE_URL ? describe : describe.skip

suite('endereço', () => {
  let pool: import('pg').Pool
  let db: any
  let schema: typeof import('../schema/schema')
  let add: import('./Address.use-case').AddAddressUseCase
  let update: import('./Address.use-case').UpdateAddressUseCase
  let remove: import('./Address.use-case').RemoveAddressUseCase

  beforeAll(async () => {
    const { Pool } = await import('pg')
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const uc = await import('./Address.use-case')
    schema = await import('../schema/schema')

    pool = new Pool({ connectionString: DATABASE_URL })
    db = drizzle({ client: pool })
    add = new uc.AddAddressUseCase({ db })
    update = new uc.UpdateAddressUseCase({ db })
    remove = new uc.RemoveAddressUseCase({ db })
  })

  afterAll(async () => {
    await pool?.end()
  })

  beforeEach(async () => {
    await pool.query('truncate "customer"."customers" cascade')
  })

  async function novoCliente(): Promise<string> {
    const [row] = await db.insert(schema.customers).values({ name: 'Anderson' }).returning({ id: schema.customers.id })
    return row!.id
  }

  async function primarios(customerId: string): Promise<string[]> {
    const { rows } = await pool.query(
      `select id from "customer"."customer_addresses" where customer_id=$1 and is_primary`,
      [customerId],
    )
    return rows.map((row) => row.id)
  }

  it('o primeiro endereço é primário sem ninguém pedir', async () => {
    const id = await novoCliente()
    const casa = await add.execute({ customerId: id, address: { street: 'Rua A' } })

    expect(casa.isPrimary).toBe(true)
  })

  it('o segundo NÃO rouba o primário, a menos que peça', async () => {
    const id = await novoCliente()
    const casa = await add.execute({ customerId: id, address: { street: 'Rua A' } })
    const trabalho = await add.execute({ customerId: id, address: { street: 'Rua B' } })

    expect(trabalho.isPrimary).toBe(false)
    expect(await primarios(id)).toEqual([casa.id])
  })

  it('promover um endereço rebaixa o anterior — nunca há dois primários', async () => {
    const id = await novoCliente()
    await add.execute({ customerId: id, address: { street: 'Rua A' } })
    const trabalho = await add.execute({ customerId: id, address: { street: 'Rua B', isPrimary: true } })

    expect(await primarios(id)).toEqual([trabalho.id])
  })

  it('atualizar o próprio primário não o rebaixa a si mesmo', async () => {
    const id = await novoCliente()
    const casa = await add.execute({ customerId: id, address: { street: 'Rua A' } })
    await update.execute({
      customerId: id,
      addressId: casa.id,
      address: { street: 'Rua A', number: '10', isPrimary: true },
    })

    expect(await primarios(id)).toEqual([casa.id])
  })

  it('apagar o primário promove o mais antigo — o cliente não fica sem endereço de entrega', async () => {
    const id = await novoCliente()
    const casa = await add.execute({ customerId: id, address: { street: 'Rua A' } })
    const trabalho = await add.execute({ customerId: id, address: { street: 'Rua B' } })

    await remove.execute({ customerId: id, addressId: casa.id })

    expect(await primarios(id)).toEqual([trabalho.id])
  })

  it('apagar o último não promove nada nem estoura', async () => {
    const id = await novoCliente()
    const casa = await add.execute({ customerId: id, address: { street: 'Rua A' } })

    await remove.execute({ customerId: id, addressId: casa.id })

    expect(await primarios(id)).toEqual([])
  })

  it('CEP e UF são guardados normalizados, não como a tela digitou', async () => {
    const id = await novoCliente()
    await add.execute({ customerId: id, address: { zipCode: '14.020-330', state: 'sp' } })

    const { rows } = await pool.query('select zip_code, state from "customer"."customer_addresses"')
    expect(rows[0]).toEqual({ zip_code: '14020330', state: 'SP' })
  })

  it('endereço de cliente inexistente é recusado', async () => {
    expect(
      add.execute({ customerId: '00000000-0000-0000-0000-000000000000', address: { street: 'Rua A' } }),
    ).rejects.toThrow()
  })
})
