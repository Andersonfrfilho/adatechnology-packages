import { describe, expect, it } from 'bun:test'

import { DeleteConversationUseCase } from './DeleteConversation.use-case'
import { PurgeExpiredDocumentsUseCase } from './PurgeExpiredDocuments.use-case'
import type { DocumentRepository } from '../repositories/DocumentRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { DocumentRow } from '../schema/schema'

const COMPANY_ID = '22222222-2222-2222-2222-222222222222'
const NUMBER = '5511999999999'

type StorageOptions = {
  failFor?: readonly string[]
  supportsDelete?: boolean
}

function buildStorage(options: StorageOptions = {}) {
  const deleted: string[] = []

  const storage = {
    upload: async () => ({ uploadId: 'unused' }),
    getDownloadUrl: async () => 'unused',
    ...(options.supportsDelete === false
      ? {}
      : {
          delete: async (uploadId: string) => {
            if (options.failFor?.includes(uploadId)) throw new Error('storage_boom')
            deleted.push(uploadId)
          },
        }),
  }

  return { storage, deleted }
}

function buildDeleteUseCase(uploadIds: string[], storageOptions: StorageOptions = {}) {
  const { storage, deleted } = buildStorage(storageOptions)
  const sessionsDeleted: string[] = []

  const sessionRepository = {
    getContext: async () => ({ id: 'session-1' }),
    deleteByNumber: async (_companyId: string, whatsappNumber: string) => {
      sessionsDeleted.push(whatsappNumber)
    },
  } as unknown as SessionRepository

  const documentRepository = {
    listUploadIdsBySession: async () => uploadIds,
  } as unknown as DocumentRepository

  const useCase = new DeleteConversationUseCase(sessionRepository, documentRepository, storage as never)
  return { useCase, deleted, sessionsDeleted }
}

describe('DeleteConversationUseCase', () => {
  it('apaga os objetos no storage antes de apagar a conversa', async () => {
    const { useCase, deleted, sessionsDeleted } = buildDeleteUseCase(['upl_a', 'upl_b'])

    const result = await useCase.execute({ companyId: COMPANY_ID, whatsappNumber: NUMBER })

    expect(deleted).toEqual(['upl_a', 'upl_b'])
    expect(sessionsDeleted).toEqual([NUMBER])
    expect(result.deletedObjects).toBe(2)
  })

  // O caso que importa: se o binário não some, a linha NÃO pode sumir. Ela é o único ponteiro para
  // o objeto, e apagá-la transformaria uma falha reexecutável em lixo pago e inalcançável.
  it('preserva a conversa quando um objeto falha no storage', async () => {
    const { useCase, sessionsDeleted } = buildDeleteUseCase(['upl_a', 'upl_ruim'], { failFor: ['upl_ruim'] })

    const result = await useCase.execute({ companyId: COMPANY_ID, whatsappNumber: NUMBER })

    expect(result.failedObjects).toEqual(['upl_ruim'])
    expect(sessionsDeleted).toEqual([])
  })

  it('recusa quando há arquivos e o storage não implementa delete', async () => {
    const { useCase, sessionsDeleted } = buildDeleteUseCase(['upl_a'], { supportsDelete: false })

    await expect(useCase.execute({ companyId: COMPANY_ID, whatsappNumber: NUMBER })).rejects.toThrow(
      'storage_delete_unsupported',
    )
    expect(sessionsDeleted).toEqual([])
  })

  // Conversa sem anexo não deve exigir storage nenhum.
  it('apaga conversa sem arquivos mesmo sem storage', async () => {
    const { useCase, sessionsDeleted } = buildDeleteUseCase([], { supportsDelete: false })

    await useCase.execute({ companyId: COMPANY_ID, whatsappNumber: NUMBER })

    expect(sessionsDeleted).toEqual([NUMBER])
  })
})

describe('PurgeExpiredDocumentsUseCase', () => {
  function buildPurgeUseCase(rows: DocumentRow[], storageOptions: StorageOptions = {}) {
    const { storage, deleted } = buildStorage(storageOptions)
    const rowsDeleted: string[] = []

    const documentRepository = {
      listExpired: async () => rows,
      deleteById: async (_companyId: string, id: string) => {
        rowsDeleted.push(id)
      },
    } as unknown as DocumentRepository

    return { useCase: new PurgeExpiredDocumentsUseCase(documentRepository, storage as never), deleted, rowsDeleted }
  }

  const row = (id: string, uploadId: string) => ({ id, uploadId }) as DocumentRow

  it('apaga objeto e linha do que venceu', async () => {
    const { useCase, deleted, rowsDeleted } = buildPurgeUseCase([row('doc-1', 'upl_1')])

    const result = await useCase.execute({ companyId: COMPANY_ID, retentionDays: 180 })

    expect(deleted).toEqual(['upl_1'])
    expect(rowsDeleted).toEqual(['doc-1'])
    expect(result.purged).toBe(1)
  })

  // A linha fica para a próxima execução tentar de novo; contar como purgado deixaria o objeto pago
  // e sem ponteiro.
  it('mantém a linha quando o objeto falha, e segue com os outros', async () => {
    const { useCase, rowsDeleted } = buildPurgeUseCase([row('doc-1', 'upl_ruim'), row('doc-2', 'upl_2')], {
      failFor: ['upl_ruim'],
    })

    const result = await useCase.execute({ companyId: COMPANY_ID, retentionDays: 180 })

    expect(result.failed).toEqual(['upl_ruim'])
    expect(rowsDeleted).toEqual(['doc-2'])
    expect(result.purged).toBe(1)
  })

  it('recusa sem storage que implemente delete', async () => {
    const { useCase } = buildPurgeUseCase([row('doc-1', 'upl_1')], { supportsDelete: false })

    await expect(useCase.execute({ companyId: COMPANY_ID, retentionDays: 180 })).rejects.toThrow(
      'storage_delete_unsupported',
    )
  })
})
