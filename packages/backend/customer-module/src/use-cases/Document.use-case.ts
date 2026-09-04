/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Documento do cliente: gravar, ler e encontrar o dono — inclusive quando o valor é cifrado.
 */

import { and, eq } from 'drizzle-orm'

import type { DocumentCipherPort, CustomerDocument, DocumentDefinition } from '@adatechnology/customer-contracts'
import { UnknownFieldError } from '@adatechnology/customer-contracts'

import type { CustomerDatabase } from '../database.types'
import { customerDocuments } from '../schema/schema'
import type { CustomerDocumentRow } from '../schema/schema'
import { normalizeDocument } from '../shared/normalize'

export type DocumentDependencies = {
  readonly db: CustomerDatabase
  /** Ausente = nenhum documento é cifrado, e `encryptedDocuments` precisa estar vazio. */
  readonly cipher?: DocumentCipherPort
  readonly encryptedDocuments: readonly string[]
}

export class SetDocumentUseCase {
  constructor(private readonly dependencies: DocumentDependencies) {}

  async execute(params: {
    customerId: string
    companyId?: string
    name: string
    value: string
    /** O catálogo da instalação. Documento fora dele não entra. */
    catalog: readonly DocumentDefinition[]
    valid?: boolean
  }): Promise<void> {
    if (!params.catalog.some((definition) => definition.name === params.name)) {
      throw new UnknownFieldError(params.name)
    }

    /*
     * Normaliza ANTES de cifrar e de imprimir. `123.456.789-01` e `12345678901` são o mesmo CPF, e
     * como o texto cifrado difere a cada gravação, a impressão é a única coisa que os aproxima — se
     * a entrada não estiver normalizada, ela sai diferente e o índice cego não acha nada.
     */
    const normalized = normalizeDocument(params.value)
    const shouldEncrypt = this.dependencies.encryptedDocuments.includes(params.name)

    const stored = shouldEncrypt ? await this.cipher().encrypt(normalized) : normalized
    const fingerprint = shouldEncrypt ? await this.cipher().fingerprint(normalized) : null

    await this.dependencies.db
      .insert(customerDocuments)
      .values({
        customerId: params.customerId,
        ...(params.companyId ? { companyId: params.companyId } : {}),
        name: params.name,
        value: stored,
        fingerprint,
        valid: params.valid ?? null,
      })
      .onConflictDoUpdate({
        target: [customerDocuments.customerId, customerDocuments.name],
        set: { value: stored, fingerprint, valid: params.valid ?? null, updatedAt: new Date() },
      })
  }

  private cipher(): DocumentCipherPort {
    const { cipher } = this.dependencies
    if (!cipher) {
      throw new Error('`encryptedDocuments` foi declarado, mas nenhuma cifra foi plugada pelo host.')
    }
    return cipher
  }
}

/**
 * "Quem é o dono deste CPF?"
 *
 * Cifrado, compara a IMPRESSÃO — o texto cifrado difere a cada gravação e não serve para comparar.
 * Em claro, compara o próprio valor. Os dois caminhos têm índice; nenhum decifra a base.
 */
export class FindByDocumentUseCase {
  constructor(private readonly dependencies: DocumentDependencies) {}

  async execute(params: { name: string; value: string }): Promise<string | undefined> {
    const normalized = normalizeDocument(params.value)
    const encrypted = this.dependencies.encryptedDocuments.includes(params.name)

    const comparison = encrypted
      ? eq(customerDocuments.fingerprint, await this.dependencies.cipher!.fingerprint(normalized))
      : eq(customerDocuments.value, normalized)

    const [row] = await this.dependencies.db
      .select({ customerId: customerDocuments.customerId })
      .from(customerDocuments)
      .where(and(eq(customerDocuments.name, params.name), comparison))
      .limit(1)

    return row?.customerId
  }
}

/** Devolve decifrado: quem lê pelo módulo não precisa saber o que estava cifrado. */
export async function toCustomerDocuments(params: {
  readonly rows: readonly CustomerDocumentRow[]
  readonly cipher?: DocumentCipherPort
  readonly encryptedDocuments: readonly string[]
}): Promise<CustomerDocument[]> {
  return Promise.all(
    params.rows.map(async (row) => ({
      id: row.id,
      name: row.name,
      value:
        params.encryptedDocuments.includes(row.name) && params.cipher
          ? await params.cipher.decrypt(row.value)
          : row.value,
      ...(row.valid === null ? {} : { valid: row.valid }),
    })),
  )
}
