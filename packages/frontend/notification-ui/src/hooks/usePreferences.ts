/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NotificationPreference, UpsertTemplateBody } from '@adatechnology/notification-contracts'

import { useNotificationContext } from '../NotificationProvider'
import { NOTIFICATION_QUERY_KEYS } from './queryKeys'

export function usePreferences() {
  const { client } = useNotificationContext()

  return useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.preferences(),
    queryFn: () => client.getPreferences(),
  })
}

export function useUpdatePreferences() {
  const { client } = useNotificationContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (preferences: readonly NotificationPreference[]) => client.updatePreferences(preferences),
    onSuccess(saved) {
      // A resposta já é o estado persistido — usar direto evita um refetch e o piscar do painel
      // entre o valor otimista e o confirmado.
      queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.preferences(), saved)
    },
  })
}

export function useTemplates() {
  const { client } = useNotificationContext()

  return useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.templates(),
    queryFn: () => client.listTemplates(),
  })
}

/**
 * Salva uma VERSÃO nova do template. É o que a tela de configuração usa para o lojista mudar a copy
 * sem deploy.
 *
 * Invalida em vez de escrever no cache: o servidor decide o número da versão, então o objeto salvo
 * traz um campo que o otimista não teria como prever — e mostrar "versão 3" quando o banco gravou 4
 * confunde exatamente quem está tentando conferir o que salvou.
 */
export function useUpsertTemplate() {
  const { client } = useNotificationContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpsertTemplateBody) => client.upsertTemplate(input),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.templates() })
    },
  })
}
