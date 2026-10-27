/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Endereço do CLIENTE, que é o cadastro — não o endereço de uma entrega, que é histórico do pedido
 * e não pode mudar quando o cliente se muda (spec §4.5).
 */

import { and, eq, sql } from 'drizzle-orm'

import type { CustomerAddress } from '@adatechnology/customer-contracts'
import { CustomerNotFoundError } from '@adatechnology/customer-contracts'

import type { CustomerDatabase } from '../database.types'
import { customerAddresses, customers } from '../schema/schema'
import { normalizeZipCode } from '../shared/normalize'

export type AddressInput = Omit<CustomerAddress, 'id' | 'isPrimary'> & { readonly isPrimary?: boolean }

type Dependencies = { readonly db: CustomerDatabase }

/** Só uma linha do cliente fica primária. A exclusividade é da transação, não da tela. */
async function demoteAll(tx: CustomerDatabase, customerId: string): Promise<void> {
  await tx
    .update(customerAddresses)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(and(eq(customerAddresses.customerId, customerId), eq(customerAddresses.isPrimary, true)))
}

function toRow(input: AddressInput) {
  return {
    label: input.label ?? null,
    zipCode: input.zipCode ? normalizeZipCode(input.zipCode) : null,
    street: input.street ?? null,
    number: input.number ?? null,
    complement: input.complement ?? null,
    district: input.district ?? null,
    city: input.city ?? null,
    state: input.state ? input.state.toUpperCase() : null,
  }
}

export class AddAddressUseCase {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(params: { customerId: string; address: AddressInput }): Promise<CustomerAddress> {
    return this.dependencies.db.transaction(async (tx) => {
      const [customer] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, params.customerId))
        .limit(1)

      if (!customer) throw new CustomerNotFoundError()

      const [existing] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(customerAddresses)
        .where(eq(customerAddresses.customerId, params.customerId))

      // O primeiro endereço é primário sem ninguém pedir: cliente com um endereço só e nenhum
      // marcado é o caso em que a entrega não sabe para onde ir.
      const isPrimary = params.address.isPrimary ?? (existing?.count ?? 0) === 0

      if (isPrimary) await demoteAll(tx, params.customerId)

      const [row] = await tx
        .insert(customerAddresses)
        .values({ customerId: params.customerId, ...toRow(params.address), isPrimary })
        .returning()

      return toCustomerAddress(row!)
    })
  }
}

export class UpdateAddressUseCase {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(params: { customerId: string; addressId: string; address: AddressInput }): Promise<CustomerAddress> {
    return this.dependencies.db.transaction(async (tx) => {
      if (params.address.isPrimary) await demoteAll(tx, params.customerId)

      const [row] = await tx
        .update(customerAddresses)
        .set({
          ...toRow(params.address),
          ...(params.address.isPrimary === undefined ? {} : { isPrimary: params.address.isPrimary }),
          updatedAt: new Date(),
        })
        .where(and(eq(customerAddresses.id, params.addressId), eq(customerAddresses.customerId, params.customerId)))
        .returning()

      if (!row) throw new CustomerNotFoundError()

      return toCustomerAddress(row)
    })
  }
}

export class RemoveAddressUseCase {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(params: { customerId: string; addressId: string }): Promise<void> {
    await this.dependencies.db.transaction(async (tx) => {
      const [removed] = await tx
        .delete(customerAddresses)
        .where(and(eq(customerAddresses.id, params.addressId), eq(customerAddresses.customerId, params.customerId)))
        .returning({ isPrimary: customerAddresses.isPrimary })

      if (!removed?.isPrimary) return

      // Apagar o primário não pode deixar o cliente sem nenhum: o mais antigo assume.
      const [next] = await tx
        .select({ id: customerAddresses.id })
        .from(customerAddresses)
        .where(eq(customerAddresses.customerId, params.customerId))
        .orderBy(customerAddresses.createdAt)
        .limit(1)

      if (next) {
        await tx
          .update(customerAddresses)
          .set({ isPrimary: true, updatedAt: new Date() })
          .where(eq(customerAddresses.id, next.id))
      }
    })
  }
}

export function toCustomerAddress(row: typeof customerAddresses.$inferSelect): CustomerAddress {
  return {
    id: row.id,
    ...(row.label ? { label: row.label } : {}),
    ...(row.zipCode ? { zipCode: row.zipCode } : {}),
    ...(row.street ? { street: row.street } : {}),
    ...(row.number ? { number: row.number } : {}),
    ...(row.complement ? { complement: row.complement } : {}),
    ...(row.district ? { district: row.district } : {}),
    ...(row.city ? { city: row.city } : {}),
    ...(row.state ? { state: row.state } : {}),
    isPrimary: row.isPrimary,
  }
}
