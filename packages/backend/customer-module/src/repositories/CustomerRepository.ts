/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, eq, exists, isNull, or, sql } from 'drizzle-orm'

import type { CustomerDatabase } from '../database.types'
import { customerAddresses, customerDocuments, customerPhones, customers } from '../schema/schema'
import type { CustomerRow } from '../schema/schema'
import { toSearchPattern } from '../shared/normalize'

export type CustomerAggregate = {
  readonly customer: CustomerRow
  readonly phones: (typeof customerPhones.$inferSelect)[]
  readonly documents: (typeof customerDocuments.$inferSelect)[]
  readonly addresses: (typeof customerAddresses.$inferSelect)[]
}

export type ListParams = {
  readonly companyId: string | undefined
  readonly page: number
  readonly perPage: number
  readonly search?: string
}

export class CustomerRepository {
  constructor(private readonly db: CustomerDatabase) {}

  /** `company_id IS NULL` em single-tenant; `=` em multi. Um lugar só decide isso. */
  private scope(companyId: string | undefined) {
    return companyId === undefined ? isNull(customers.companyId) : eq(customers.companyId, companyId)
  }

  /**
   * O CAMINHO QUENTE: roda a cada mensagem recebida.
   *
   * Uma consulta, servida pelo índice único parcial — não há varredura nem duas idas ao banco.
   */
  async findByWhatsAppPhone(params: {
    companyId: string | undefined
    number: string
  }): Promise<CustomerRow | undefined> {
    const [row] = await this.db
      .select()
      .from(customers)
      .innerJoin(customerPhones, eq(customerPhones.customerId, customers.id))
      .where(
        and(
          eq(customerPhones.number, params.number),
          eq(customerPhones.isWhatsApp, true),
          this.scope(params.companyId),
          isNull(customers.deletedAt),
        ),
      )
      .limit(1)

    return row?.customers
  }

  async findById(params: { companyId: string | undefined; id: string }): Promise<CustomerAggregate | undefined> {
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, params.id), this.scope(params.companyId)))
      .limit(1)

    if (!customer) return undefined

    // Três consultas e não três junções: junção com N coleções multiplica linhas e obriga a
    // desduplicar em memória, que é onde esse tipo de código costuma errar a contagem.
    const [phones, documents, addresses] = await Promise.all([
      this.db.select().from(customerPhones).where(eq(customerPhones.customerId, customer.id)),
      this.db.select().from(customerDocuments).where(eq(customerDocuments.customerId, customer.id)),
      this.db.select().from(customerAddresses).where(eq(customerAddresses.customerId, customer.id)),
    ])

    return { customer, phones, documents, addresses }
  }

  /**
   * Busca por nome ou por QUALQUER telefone.
   *
   * `EXISTS` e não junção: o cliente com três telefones apareceria três vezes numa junção, e o
   * total da paginação sairia errado.
   */
  async list(params: ListParams): Promise<{ rows: CustomerRow[]; total: number }> {
    const conditions = [this.scope(params.companyId), isNull(customers.deletedAt)]

    if (params.search) {
      const pattern = toSearchPattern(params.search)
      const byPhone = this.db
        .select({ one: sql`1` })
        .from(customerPhones)
        .where(
          and(
            eq(customerPhones.customerId, customers.id),
            sql`${customerPhones.number} ilike ${pattern.digits ?? pattern.text}`,
          ),
        )

      conditions.push(or(sql`${customers.name} ilike ${pattern.text}`, exists(byPhone))!)
    }

    const where = and(...conditions)

    const [rows, [counted]] = await Promise.all([
      this.db
        .select()
        .from(customers)
        .where(where)
        .orderBy(customers.name)
        .limit(params.perPage)
        .offset((params.page - 1) * params.perPage),
      this.db.select({ total: sql<number>`count(*)::int` }).from(customers).where(where),
    ])

    return { rows, total: counted?.total ?? 0 }
  }
}
