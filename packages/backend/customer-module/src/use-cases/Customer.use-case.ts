/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Criação e edição pelo PAINEL. O `UpsertByPhone` é a porta do canal — chega um número e o cliente
 * pode nem existir; aqui alguém preencheu uma ficha, e tudo que ela traz passa pelo catálogo antes
 * de encostar no banco.
 */

import { and, eq, isNull } from 'drizzle-orm'

import type {
  CreateCustomerInput,
  Customer,
  CustomerSettings,
  DocumentCipherPort,
} from '@adatechnology/customer-contracts'
import { CustomerNotFoundError, WhatsAppPhoneTakenError } from '@adatechnology/customer-contracts'

import type { CustomerDatabase } from '../database.types'
import type { CustomerAggregate, CustomerRepository } from '../repositories/CustomerRepository'
import { customerAddresses, customerPhones, customers } from '../schema/schema'
import { normalizePhone, normalizeZipCode } from '../shared/normalize'
import { CUSTOMER_CONSTRAINT, isUniqueViolation } from '../shared/postgresErrors'
import { toCustomerAddress } from './Address.use-case'
import { SetDocumentUseCase, toCustomerDocuments } from './Document.use-case'
import { validateAttributes } from './validateAttributes'

export type CustomerDependencies = {
  readonly db: CustomerDatabase
  readonly repository: CustomerRepository
  readonly setDocument: SetDocumentUseCase
  readonly defaultCountryCode?: string
  readonly cipher?: DocumentCipherPort
  readonly encryptedDocuments?: readonly string[]
}

export class CreateCustomerUseCase {
  constructor(private readonly dependencies: CustomerDependencies) {}

  async execute(params: {
    companyId?: string
    input: CreateCustomerInput
    settings: CustomerSettings
  }): Promise<string> {
    const { input, settings } = params

    // Catálogo antes de transação: recusar depois de abrir escrita é trabalho jogado fora, e o erro
    // que o operador vê é o mesmo.
    validateAttributes({ attributes: input.attributes, catalog: settings.fieldCatalog })

    const customerId = await this.createInTransaction({ ...params, input, settings }).catch((error: unknown) => {
      /*
       * O número de WhatsApp já é de outro cliente. O `UpsertByPhone` trata isso relendo, porque lá
       * duas mensagens do mesmo número são a mesma pessoa; AQUI é uma ficha nova sendo cadastrada
       * com um número que já tem dono, e reler juntaria duas pessoas numa só.
       *
       * Sem esta tradução o operador recebe "Erro interno" e não tem o que fazer com isso — o
       * conflito é 409, e a mensagem diz qual é.
       */
      if (isUniqueViolation(error, CUSTOMER_CONSTRAINT.WHATSAPP_PHONE)) throw new WhatsAppPhoneTakenError()
      throw error
    })

    // Documento fica FORA da transação de propósito: cifrar chama porta do host, que pode ser
    // serviço de rede, e prender uma conexão de banco esperando rede é como se esgota o pool.
    for (const document of input.documents) {
      await this.dependencies.setDocument.execute({
        customerId,
        name: document.name,
        value: document.value,
        catalog: settings.documentCatalog,
      })
    }

    return customerId
  }

  private async createInTransaction(params: {
    companyId?: string
    input: CreateCustomerInput
    settings: CustomerSettings
  }): Promise<string> {
    const { input } = params

    return this.dependencies.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(customers)
        .values({
          companyId: params.companyId ?? null,
          name: input.name ?? null,
          email: input.email ?? null,
          birthDate: input.birthDate ?? null,
          attributes: input.attributes,
        })
        .returning({ id: customers.id })

      const id = row!.id

      if (input.phones.length > 0) {
        // Só um número é WhatsApp: a ficha que chega com dois marcados perde a marca do segundo em
        // vez de estourar no índice único, que diria "número já pertence a outro cliente" — mensagem
        // errada para o problema certo.
        let whatsAppTaken = false
        await tx.insert(customerPhones).values(
          input.phones.map((phone, index) => {
            const isWhatsApp = Boolean(phone.isWhatsApp) && !whatsAppTaken
            if (isWhatsApp) whatsAppTaken = true
            return {
              customerId: id,
              number: normalizePhone(phone.number, this.dependencies.defaultCountryCode),
              label: phone.label ?? null,
              isWhatsApp,
              isPrimary: phone.isPrimary ?? (!input.phones.some((other) => other.isPrimary) && index === 0),
            }
          }),
        )
      }

      if (input.addresses.length > 0) {
        await tx.insert(customerAddresses).values(
          input.addresses.map((address, index) => ({
            customerId: id,
            label: address.label ?? null,
            zipCode: address.zipCode ? normalizeZipCode(address.zipCode) : null,
            street: address.street ?? null,
            number: address.number ?? null,
            complement: address.complement ?? null,
            district: address.district ?? null,
            city: address.city ?? null,
            state: address.state ? address.state.toUpperCase() : null,
            isPrimary: address.isPrimary ?? (!input.addresses.some((other) => other.isPrimary) && index === 0),
          })),
        )
      }

      return id
    })
  }
}

export type UpdateCustomerInput = {
  readonly name?: string
  readonly email?: string
  readonly birthDate?: string
  readonly attributes?: Record<string, unknown>
}

export class UpdateCustomerUseCase {
  constructor(private readonly dependencies: CustomerDependencies) {}

  async execute(params: {
    companyId?: string
    customerId: string
    input: UpdateCustomerInput
    settings: CustomerSettings
  }): Promise<void> {
    if (params.input.attributes) {
      validateAttributes({ attributes: params.input.attributes, catalog: params.settings.fieldCatalog })
    }

    const [row] = await this.dependencies.db
      .update(customers)
      .set({
        ...(params.input.name === undefined ? {} : { name: params.input.name }),
        ...(params.input.email === undefined ? {} : { email: params.input.email }),
        ...(params.input.birthDate === undefined ? {} : { birthDate: params.input.birthDate }),
        ...(params.input.attributes === undefined ? {} : { attributes: params.input.attributes }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customers.id, params.customerId),
          // Mesmo escopo do repositório: em single-tenant a linha tem `company_id` nulo, e comparar
          // por igualdade com `undefined` não filtraria nada.
          params.companyId === undefined ? isNull(customers.companyId) : eq(customers.companyId, params.companyId),
        ),
      )
      .returning({ id: customers.id })

    if (!row) throw new CustomerNotFoundError()
  }
}

/** Um cliente montado para a tela. Documento cifrado sai DECIFRADO — a lista não, o detalhe sim. */
export async function toCustomer(params: {
  aggregate: CustomerAggregate
  cipher?: DocumentCipherPort
  encryptedDocuments?: readonly string[]
}): Promise<Customer> {
  const { customer } = params.aggregate

  return {
    id: customer.id,
    ...(customer.name ? { name: customer.name } : {}),
    ...(customer.email ? { email: customer.email } : {}),
    ...(customer.birthDate ? { birthDate: customer.birthDate } : {}),
    phones: params.aggregate.phones.map((phone) => ({
      id: phone.id,
      number: phone.number,
      ...(phone.label ? { label: phone.label } : {}),
      isWhatsApp: phone.isWhatsApp,
      isPrimary: phone.isPrimary,
    })),
    addresses: params.aggregate.addresses.map(toCustomerAddress),
    documents: await toCustomerDocuments({
      rows: params.aggregate.documents,
      ...(params.cipher ? { cipher: params.cipher } : {}),
      encryptedDocuments: params.encryptedDocuments ?? [],
    }),
    attributes: (customer.attributes ?? {}) as Record<string, unknown>,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  }
}
