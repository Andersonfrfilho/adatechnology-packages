import { describe, expect, it } from 'bun:test'

import {
  dedupeMessagesById,
  pageIndicatesMoreOlderMessages,
  prependOlderMessages,
  shouldFetchOlderMessages,
} from './useConversationMessages'
import type { MessagePayload } from '../types'

function buildMessage(id: string, timestamp: string): MessagePayload {
  return { id, type: 'text', content: id, direction: 'inbound', sender: 'customer', timestamp }
}

describe('dedupeMessagesById', () => {
  it('mantém a primeira ocorrência de cada id e descarta as repetidas', () => {
    const first = buildMessage('1', '2026-09-01T10:00:00.000Z')
    const duplicate = buildMessage('1', '2026-09-01T10:00:00.000Z')
    const second = buildMessage('2', '2026-09-01T10:01:00.000Z')

    expect(dedupeMessagesById([first, duplicate, second])).toEqual([first, second])
  })
})

describe('prependOlderMessages', () => {
  it('prepende a página anterior descartando o que já estava carregado', () => {
    const accumulated = [buildMessage('3', '2026-09-01T10:02:00.000Z')]
    const olderPage = [buildMessage('1', '2026-09-01T10:00:00.000Z'), buildMessage('2', '2026-09-01T10:01:00.000Z')]

    expect(prependOlderMessages(accumulated, olderPage)).toEqual([...olderPage, ...accumulated])
  })

  it('não duplica quando a mesma página anterior chega de novo', () => {
    const message = buildMessage('1', '2026-09-01T10:00:00.000Z')
    const accumulated = [message]

    expect(prependOlderMessages(accumulated, [message])).toEqual([message])
  })
})

describe('shouldFetchOlderMessages', () => {
  const oldestMessage = buildMessage('1', '2026-09-01T10:00:00.000Z')

  it('busca quando não há requisição em voo, ainda há mais páginas e existe uma mensagem mais antiga', () => {
    expect(shouldFetchOlderMessages({ isLoading: false, hasMore: true, oldestMessage })).toBe(true)
  })

  it('não dispara requisição concorrente enquanto uma já está em voo', () => {
    expect(shouldFetchOlderMessages({ isLoading: true, hasMore: true, oldestMessage })).toBe(false)
  })

  it('para de buscar quando uma página anterior já veio incompleta (hasMore=false)', () => {
    expect(shouldFetchOlderMessages({ isLoading: false, hasMore: false, oldestMessage })).toBe(false)
  })

  it('não busca sem mensagem mais antiga para servir de before', () => {
    expect(shouldFetchOlderMessages({ isLoading: false, hasMore: true, oldestMessage: undefined })).toBe(false)
  })
})

describe('pageIndicatesMoreOlderMessages', () => {
  it('página completa (igual ao limite) indica que pode haver mais', () => {
    expect(pageIndicatesMoreOlderMessages(50, 50)).toBe(true)
  })

  it('página menor que o limite indica que não há mais mensagens antigas', () => {
    expect(pageIndicatesMoreOlderMessages(12, 50)).toBe(false)
  })

  it('página vazia indica que não há mais mensagens antigas', () => {
    expect(pageIndicatesMoreOlderMessages(0, 50)).toBe(false)
  })
})

describe('preservação do histórico ao chegar mensagem nova (SSE/polling)', () => {
  it('combina o acumulado antigo com a janela recente sem perder páginas já carregadas', () => {
    const olderMessages = [buildMessage('1', '2026-09-01T10:00:00.000Z'), buildMessage('2', '2026-09-01T10:01:00.000Z')]
    const recentWindowBeforeNewMessage = [buildMessage('3', '2026-09-01T10:02:00.000Z')]
    const recentWindowAfterNewMessage = [
      buildMessage('3', '2026-09-01T10:02:00.000Z'),
      buildMessage('4', '2026-09-01T10:03:00.000Z'),
    ]

    const before = dedupeMessagesById([...olderMessages, ...recentWindowBeforeNewMessage])
    const after = dedupeMessagesById([...olderMessages, ...recentWindowAfterNewMessage])

    expect(before.map((message) => message.id)).toEqual(['1', '2', '3'])
    expect(after.map((message) => message.id)).toEqual(['1', '2', '3', '4'])
  })
})
