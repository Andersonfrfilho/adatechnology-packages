/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Achar ou criar o cliente pelo número do WhatsApp. Roda a CADA mensagem recebida.
 */

import { and, eq } from 'drizzle-orm'

import type { CustomerDatabase } from '../database.types'
import { customerPhones, customers } from '../schema/schema'
import type { CustomerRow } from '../schema/schema'
import { CustomerRepository } from '../repositories/CustomerRepository'
import { normalizePhone } from '../shared/normalize'

export type UpsertByPhoneParams = {
  readonly companyId?: string
  readonly number: string
  /** O nome que o canal informou, quando informou. Nunca sobrescreve um nome já gravado. */
  readonly name?: string
}

export class UpsertByPhoneUseCase {
  constructor(
    private readonly db: CustomerDatabase,
    private readonly repository: CustomerRepository,
    /** Sem ele, o número digitado no painel sem DDI não casa com o que o canal entrega. */
    private readonly defaultCountryCode?: string,
  ) {}

  async execute(params: UpsertByPhoneParams): Promise<CustomerRow> {
    const number = normalizePhone(params.number, this.defaultCountryCode)
    const companyId = params.companyId

    const existing = await this.repository.findByWhatsAppPhone({ companyId, number })
    if (existing) return existing

    try {
      return await this.create({ companyId, number, name: params.name })
    } catch (error) {
      /*
       * Duas mensagens do mesmo número chegando juntas é o caso COMUM, não o raro: a pessoa manda
       * "oi" e o nome em seguida, e os dois webhooks correm. A consulta acima diz "não existe" nas
       * duas, e a segunda inserção bate no índice único.
       *
       * Perder a corrida não é erro — é a confirmação de que o outro caminho já criou. Reler é a
       * resposta certa; propagar faria a mensagem do cliente sumir.
       */
      const raced = await this.repository.findByWhatsAppPhone({ companyId, number })
      if (raced) return raced
      throw error
    }
  }

  private async create(params: { companyId?: string; number: string; name?: string }): Promise<CustomerRow> {
    // Cliente e telefone na MESMA transação: cliente sem telefone de WhatsApp é ficha que a próxima
    // mensagem não encontra — um estado que não pode existir nem por um instante.
    return this.db.transaction(async (tx) => {
      const [customer] = await tx
        .insert(customers)
        .values({
          ...(params.companyId ? { companyId: params.companyId } : {}),
          ...(params.name ? { name: params.name } : {}),
        })
        .returning()

      await tx.insert(customerPhones).values({
        customerId: customer!.id,
        ...(params.companyId ? { companyId: params.companyId } : {}),
        number: params.number,
        isWhatsApp: true,
        isPrimary: true,
      })

      return customer!
    })
  }
}

/**
 * Marca um número como o do WhatsApp, DESMARCANDO o anterior na mesma transação.
 *
 * Use-case separado porque a troca tem dois passos, e deixar o host coordená-los é deixá-lo parar
 * no meio — com zero números marcados (a próxima mensagem não acha ninguém) ou dois (o índice
 * recusa a escrita e a operação falha pela metade).
 */
export class SetWhatsAppPhoneUseCase {
  constructor(private readonly db: CustomerDatabase) {}

  async execute(params: { customerId: string; phoneId: string }): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(customerPhones)
        .set({ isWhatsApp: false, updatedAt: new Date() })
        .where(and(eq(customerPhones.customerId, params.customerId), eq(customerPhones.isWhatsApp, true)))

      await tx
        .update(customerPhones)
        .set({ isWhatsApp: true, updatedAt: new Date() })
        .where(and(eq(customerPhones.id, params.phoneId), eq(customerPhones.customerId, params.customerId)))
    })
  }
}
