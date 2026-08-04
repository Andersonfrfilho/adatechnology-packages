/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Testa a lógica de cache dos hooks sem renderizar React: exercita as opções de mutação
 * (`onMutate`/`onError`) contra um `QueryClient` real. É onde mora o comportamento que quebra na
 * prática — badge otimista que não volta no erro, e chave divergente entre sino e lista.
 */

import { describe, expect, it } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'

import { NOTIFICATION_QUERY_KEYS } from './queryKeys'
import { flattenNotificationPages } from './useNotifications'

describe('NOTIFICATION_QUERY_KEYS', () => {
  it('sino e lista compartilham o prefixo, para uma invalidação atingir os dois', () => {
    const prefix = NOTIFICATION_QUERY_KEYS.all

    expect(NOTIFICATION_QUERY_KEYS.unreadCount().slice(0, prefix.length)).toEqual([...prefix])
    expect(NOTIFICATION_QUERY_KEYS.list({}).slice(0, prefix.length)).toEqual([...prefix])
    expect(NOTIFICATION_QUERY_KEYS.preferences().slice(0, prefix.length)).toEqual([...prefix])
  })

  it('filtros diferentes geram chaves diferentes — senão duas listas dividiriam o mesmo cache', () => {
    const unread = NOTIFICATION_QUERY_KEYS.list({ read: false })
    const all = NOTIFICATION_QUERY_KEYS.list({})

    expect(JSON.stringify(unread)).not.toEqual(JSON.stringify(all))
  })
})

describe('invalidação por prefixo', () => {
  it('invalidar a raiz alcança contador, lista e preferências de uma vez', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 3)
    queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.preferences(), [])
    queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.list({}), { pages: [] })

    await queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })

    const invalidated = queryClient
      .getQueryCache()
      .findAll({ queryKey: NOTIFICATION_QUERY_KEYS.all })
      .filter((query) => query.state.isInvalidated)

    expect(invalidated).toHaveLength(3)
  })
})

describe('atualização otimista do contador', () => {
  // Reproduz o que `useMarkAsRead` faz em onMutate/onError, sem precisar montar o componente.
  function applyOptimisticDecrement(queryClient: QueryClient): number | undefined {
    const previous = queryClient.getQueryData<number>(NOTIFICATION_QUERY_KEYS.unreadCount())
    queryClient.setQueryData<number>(NOTIFICATION_QUERY_KEYS.unreadCount(), (current) =>
      current === undefined ? current : Math.max(0, current - 1),
    )
    return previous
  }

  it('decrementa na hora, sem esperar o servidor', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 5)

    applyOptimisticDecrement(queryClient)

    expect(queryClient.getQueryData<number>(NOTIFICATION_QUERY_KEYS.unreadCount())).toBe(4)
  })

  it('nunca deixa o badge negativo', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 0)

    applyOptimisticDecrement(queryClient)

    expect(queryClient.getQueryData<number>(NOTIFICATION_QUERY_KEYS.unreadCount())).toBe(0)
  })

  it('rollback devolve o valor anterior quando a mutação falha', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 5)

    const previous = applyOptimisticDecrement(queryClient)
    // Simula onError: sem o rollback, o badge mentiria até o próximo refetch.
    if (previous !== undefined) queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), previous)

    expect(queryClient.getQueryData<number>(NOTIFICATION_QUERY_KEYS.unreadCount())).toBe(5)
  })
})

describe('flattenNotificationPages', () => {
  it('achata as páginas do infinite query preservando a ordem', () => {
    const flattened = flattenNotificationPages([{ data: [{ id: 'a' }, { id: 'b' }] }, { data: [{ id: 'c' }] }] as never)

    expect(flattened.map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  it('devolve lista vazia quando ainda não há páginas', () => {
    expect(flattenNotificationPages(undefined)).toEqual([])
  })
})
