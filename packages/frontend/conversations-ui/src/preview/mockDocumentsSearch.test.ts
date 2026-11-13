/**
 * Guarda a busca da biblioteca no mock — que é a implementação de referência da UI do SDK e tem de
 * casar com o `companyDocumentSearch` do backend, senão o preview ensina um comportamento que a
 * tela real não entrega.
 */

import { describe, expect, it } from 'bun:test'

import { createMockConversationsApi } from './createMockConversationsApi'
import { createPreviewStore } from './previewStore'
import { PREVIEW_CONVERSATIONS, PREVIEW_MESSAGES } from './previewFixtures'

function buildApi() {
  const store = createPreviewStore({ conversations: PREVIEW_CONVERSATIONS, messages: PREVIEW_MESSAGES })
  return createMockConversationsApi({ store })
}

async function search(term: string): Promise<{ total: number; conversations: string[] }> {
  const page = await buildApi().getAllDocuments!({ search: term })
  return { total: page.total, conversations: [...new Set(page.documents.map((document) => document.conversationId))] }
}

describe('busca da biblioteca no mock', () => {
  it('acha por nome do arquivo', async () => {
    const result = await search('contrato')

    expect(result.total).toBe(1)
  })

  it('acha por telefone da conversa', async () => {
    const porNumero = await search('94444')

    expect(porNumero.conversations).toEqual(['5511944443333'])
    expect(porNumero.total).toBeGreaterThan(0)
    // Discrimina de verdade: 98888 é conversa que existe nas fixtures, mas sem arquivo — se o
    // predicado do telefone não estivesse valendo, esta busca devolveria a biblioteca inteira.
    expect((await search('98888')).total).toBe(0)
  })

  // O caso real: o atendente copia o número como a tela o mostra.
  it('acha com o telefone formatado, como aparece na tela', async () => {
    const cru = await search('5511944443333')
    const formatado = await search('+55 (11) 94444-3333')

    expect(formatado.total).toBe(cru.total)
    expect(formatado.total).toBeGreaterThan(0)
  })

  it('não devolve nada para número de outra conversa', async () => {
    expect((await search('99999999999')).total).toBe(0)
  })

  // Sem dígito, o predicado do telefone não existe — senão qualquer palavra casaria toda conversa.
  it('termo sem dígito filtra só por nome', async () => {
    expect((await search('zzz-inexistente')).total).toBe(0)
  })
})
