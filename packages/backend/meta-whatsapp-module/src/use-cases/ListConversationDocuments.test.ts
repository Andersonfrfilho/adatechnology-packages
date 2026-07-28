import { describe, expect, it } from 'bun:test'

import { ListConversationDocumentsUseCase } from './ListConversationDocuments.use-case'
import type { DocumentRepository, ListDocumentsParams } from '../repositories/DocumentRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { DocumentRow } from '../schema/schema'

const COMPANY_ID = '22222222-2222-2222-2222-222222222222'
const NUMBER = '5511999999999'

function buildUseCase() {
  const received: ListDocumentsParams[] = []

  const sessionRepository = {
    getContext: async () => ({ id: 'session-1' }),
  } as unknown as SessionRepository

  const documentRepository = {
    listByConversation: async (params: ListDocumentsParams) => {
      received.push(params)
      return {
        rows: [
          {
            id: 'doc-1',
            filename: 'nota.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 2048,
            source: 'customer',
            linkedAt: new Date('2026-07-27T12:00:00.000Z'),
          } as DocumentRow,
        ],
        total: 42,
      }
    },
  } as unknown as DocumentRepository

  return { useCase: new ListConversationDocumentsUseCase(sessionRepository, documentRepository), received }
}

describe('ListConversationDocumentsUseCase', () => {
  it('devolve a página com o total do servidor, não o tamanho da fatia', async () => {
    const { useCase } = buildUseCase()

    const page = await useCase.execute({ companyId: COMPANY_ID, whatsappNumber: NUMBER, page: 1, limit: 10 })

    expect(page.documents).toHaveLength(1)
    // 42, e não 1: é o total que permite calcular a última página.
    expect(page.total).toBe(42)
    expect(page.documents[0]?.linkedAt).toBe('2026-07-27T12:00:00.000Z')
  })

  it('repassa filtro, ordenação e página ao repositório', async () => {
    const { useCase, received } = buildUseCase()

    await useCase.execute({
      companyId: COMPANY_ID,
      whatsappNumber: NUMBER,
      search: 'nota',
      sources: ['agent', 'bot'],
      sortDirection: 'asc',
      page: 3,
      limit: 5,
    })

    expect(received[0]?.search).toBe('nota')
    expect(received[0]?.sources).toEqual(['agent', 'bot'])
    expect(received[0]?.sortDirection).toBe('asc')
    expect(received[0]?.page).toBe(3)
    expect(received[0]?.limit).toBe(5)
  })

  // Lista vazia é "sem filtro", não "nenhuma origem aceita" — repassar `[]` faria o repositório
  // montar um `inArray` que nunca casa e a listagem viria vazia sem motivo.
  it('não repassa `sources` vazio', async () => {
    const { useCase, received } = buildUseCase()

    await useCase.execute({ companyId: COMPANY_ID, whatsappNumber: NUMBER, sources: [] })

    expect(received[0]?.sources).toBeUndefined()
  })
})
