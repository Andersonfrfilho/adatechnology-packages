import { SessionNotFoundError, type ObjectStorageInterface } from '@adatechnology/meta-whatsapp-contracts'
import type { DocumentRepository } from '../repositories/DocumentRepository'
import type { SessionRepository } from '../repositories/SessionRepository'

export type DeleteConversationParams = {
  companyId: string
  whatsappNumber: string
}

export type DeleteConversationResult = {
  /** Objetos efetivamente apagados no storage. */
  deletedObjects: number
  /** Objetos que o storage recusou. A conversa NÃO é apagada quando isto é maior que zero. */
  failedObjects: readonly string[]
}

/**
 * Apaga a conversa e a mídia dela.
 *
 * A ordem é o ponto: **storage primeiro, banco depois**. A FK de `documents.session_id` é
 * `on delete cascade`, então apagar a sessão primeiro derrubaria as linhas e levaria embora a única
 * lista de `uploadId` existente — os binários ficariam órfãos, cobrados para sempre e inalcançáveis.
 *
 * Se algum objeto falhar, a conversa é preservada e o chamador recebe a lista. Apagar as linhas
 * "mesmo assim" transformaria uma falha visível e reexecutável em lixo silencioso no storage.
 */
export class DeleteConversationUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly documentRepository: DocumentRepository,
    private readonly objectStorage?: ObjectStorageInterface,
  ) {}

  async execute(params: DeleteConversationParams): Promise<DeleteConversationResult> {
    const session = await this.sessionRepository.getContext(params.companyId, params.whatsappNumber)
    if (!session) throw new SessionNotFoundError(params.whatsappNumber)

    const uploadIds = await this.documentRepository.listUploadIdsBySession(params.companyId, session.id)

    // Sem `delete` no storage não há como cumprir a promessa de apagar a mídia. Falhar aqui é
    // melhor que apagar o transcript e deixar os arquivos para trás sem ninguém saber.
    if (uploadIds.length > 0 && !this.objectStorage?.delete) {
      throw new Error('storage_delete_unsupported: a conversa tem arquivos e o storage injetado não implementa delete')
    }

    const failedObjects: string[] = []
    let deletedObjects = 0

    for (const uploadId of uploadIds) {
      try {
        await this.objectStorage?.delete?.(uploadId)
        deletedObjects++
      } catch {
        failedObjects.push(uploadId)
      }
    }

    if (failedObjects.length > 0) return { deletedObjects, failedObjects }

    // A cascata cuida de messages e documents; a sessão é a raiz.
    await this.sessionRepository.deleteByNumber(params.companyId, params.whatsappNumber)

    return { deletedObjects, failedObjects: [] }
  }
}
