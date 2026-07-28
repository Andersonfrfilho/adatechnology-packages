import type { ObjectStorageInterface } from '@adatechnology/meta-whatsapp-contracts'
import type { DocumentRepository } from '../repositories/DocumentRepository'

export type PurgeExpiredDocumentsParams = {
  companyId: string
  /** Dias de retenção. O produto configura; o módulo não escolhe política de dado pessoal. */
  retentionDays: number
  /** Teto por execução, para o job não segurar conexão nem storage por tempo indefinido. */
  batchSize?: number
  /** Instante de referência — injetado para o teste não depender do relógio. */
  now?: Date
}

export type PurgeExpiredDocumentsResult = {
  purged: number
  failed: readonly string[]
}

const DEFAULT_BATCH_SIZE = 50
const HOURS_IN_DAY = 24
const MILLISECONDS_IN_HOUR = 60 * 60 * 1000

/**
 * Apaga documento vencido: objeto no storage primeiro, linha depois — a mesma ordem do
 * `DeleteConversationUseCase`, e pelo mesmo motivo.
 *
 * A linha só cai quando o objeto caiu. Contar como purgado sem ter apagado o binário deixaria lixo
 * pago no storage sem nenhum registro que o alcance depois: a linha era o único ponteiro.
 */
export class PurgeExpiredDocumentsUseCase {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly objectStorage?: ObjectStorageInterface,
  ) {}

  async execute(params: PurgeExpiredDocumentsParams): Promise<PurgeExpiredDocumentsResult> {
    if (!this.objectStorage?.delete) {
      throw new Error('storage_delete_unsupported: retenção exige um storage que implemente delete')
    }

    const reference = params.now ?? new Date()
    const olderThan = new Date(reference.getTime() - params.retentionDays * HOURS_IN_DAY * MILLISECONDS_IN_HOUR)

    const expired = await this.documentRepository.listExpired(
      params.companyId,
      olderThan,
      params.batchSize ?? DEFAULT_BATCH_SIZE,
    )

    const failed: string[] = []
    let purged = 0

    for (const document of expired) {
      try {
        await this.objectStorage.delete(document.uploadId)
      } catch {
        // Guarda e segue: um objeto problemático não deve impedir a limpeza dos outros, e a próxima
        // execução tenta de novo porque a linha continua lá.
        failed.push(document.uploadId)
        continue
      }

      await this.documentRepository.deleteById(params.companyId, document.id)
      purged++
    }

    return { purged, failed }
  }
}
