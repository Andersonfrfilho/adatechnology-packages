/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  updateSettingsSchema,
  type CustomerSettings,
  type DocumentDefinition,
  type FieldDefinition,
  type UpdateSettingsInput,
} from '@adatechnology/customer-contracts'
import type { FieldIndexQueuePort, LoggerPort } from '@adatechnology/customer-contracts'

import type { SettingsRepository } from '../repositories/SettingsRepository'
import type { CustomerSettingsRow } from '../schema/schema'
import {
  assertCatalogChangeIsSafe,
  assertDocumentCatalogChangeIsSafe,
  castForFieldType,
  diffFilterableFields,
} from './validateCatalogChange'

function toSettings(row: CustomerSettingsRow): CustomerSettings {
  return {
    ...(row.companyId ? { companyId: row.companyId } : {}),
    maskPhoneInList: row.maskPhoneInList,
    documentCatalog: row.documentCatalog as DocumentDefinition[],
    fieldCatalog: row.fieldCatalog as FieldDefinition[],
    updatedAt: row.updatedAt,
    ...(row.updatedByUserId ? { updatedByUserId: row.updatedByUserId } : {}),
  }
}

export class GetSettingsUseCase {
  constructor(private readonly repository: SettingsRepository) {}

  async execute(params: { companyId?: string } = {}): Promise<CustomerSettings> {
    return toSettings(await this.repository.findOrCreate(params.companyId))
  }
}

export type UpdateSettingsDependencies = {
  readonly repository: SettingsRepository
  readonly encryptedDocuments: readonly string[]
  /** Ausente = o host não plugou fila; campo `filterable` fica sem índice, e isso é dito no log. */
  readonly indexQueue?: FieldIndexQueuePort
  readonly logger?: LoggerPort
}

export class UpdateSettingsUseCase {
  constructor(private readonly dependencies: UpdateSettingsDependencies) {}

  async execute(params: {
    companyId?: string
    input: UpdateSettingsInput
    /** Quem mudou. Vai para a trilha: mexer em obrigatoriedade e em máscara de PII é ação sensível. */
    actorUserId?: string
  }): Promise<CustomerSettings> {
    // O schema cobre forma e teto; as travas abaixo dependem do que JÁ existe e não cabem nele.
    const input = updateSettingsSchema.parse(params.input)
    const current = await this.dependencies.repository.findOrCreate(params.companyId)

    const currentFields = current.fieldCatalog as FieldDefinition[]
    const currentDocuments = current.documentCatalog as DocumentDefinition[]

    assertCatalogChangeIsSafe({ current: currentFields, next: input.fieldCatalog })
    assertDocumentCatalogChangeIsSafe({
      current: currentDocuments,
      next: input.documentCatalog,
      encryptedDocuments: this.dependencies.encryptedDocuments,
    })

    const saved = await this.dependencies.repository.update({
      companyId: params.companyId,
      maskPhoneInList: input.maskPhoneInList,
      documentCatalog: input.documentCatalog,
      fieldCatalog: input.fieldCatalog,
      ...(params.actorUserId ? { updatedByUserId: params.actorUserId } : {}),
    })

    await this.syncIndexes({ current: currentFields, next: input.fieldCatalog })

    /*
     * Trilha de auditoria (`security.md` §10). Sem rótulo e sem opção: eles podem conter nome de
     * cliente ou valor de negócio, e o que importa para auditar é QUEM mudou O QUÊ, não o texto.
     */
    this.dependencies.logger?.info('customer_settings_updated', {
      ...(params.actorUserId ? { actorUserId: params.actorUserId } : {}),
      ...(params.companyId ? { companyId: params.companyId } : {}),
      maskPhoneInList: input.maskPhoneInList,
      fieldNames: input.fieldCatalog.map((field) => field.name),
      documentNames: input.documentCatalog.map((document) => document.name),
    })

    return toSettings(saved)
  }

  /**
   * O DDL sai daqui como INTENÇÃO, não como execução.
   *
   * `CREATE INDEX CONCURRENTLY` não roda dentro de transação e leva minutos em tabela grande —
   * segurá-lo numa requisição HTTP seria pedir timeout. Quem executa é a fila do host.
   */
  private async syncIndexes(change: { current: FieldDefinition[]; next: FieldDefinition[] }): Promise<void> {
    const diff = diffFilterableFields(change)
    if (diff.toCreate.length === 0 && diff.toDrop.length === 0) return

    if (!this.dependencies.indexQueue) {
      this.dependencies.logger?.warn('customer_field_index_queue_missing', {
        toCreate: diff.toCreate.map((field) => field.name),
        toDrop: diff.toDrop.map((field) => field.name),
      })
      return
    }

    for (const field of diff.toCreate) {
      await this.dependencies.indexQueue.enqueueCreate({ fieldName: field.name, castTo: castForFieldType(field.type) })
    }
    for (const field of diff.toDrop) {
      await this.dependencies.indexQueue.enqueueDrop({ fieldName: field.name })
    }
  }
}
