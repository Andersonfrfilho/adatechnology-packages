/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O roteamento: por quais canais cada categoria PODE sair, decidido pela empresa.
 *
 * É a camada que faltava. O chamador já podia enumerar canais em cada `sendNotification`, e quem
 * recebe já tinha preferência — mas "cobrança nunca sai por SMS" não cabia em nenhum dos dois:
 * o primeiro espalha a decisão por todo o código, o segundo deixa ela na mão do destinatário.
 *
 * O modelo aqui é de teto, não de piso: desligar barra o canal para todo mundo; ligar apenas
 * permite, e a preferência de quem recebe continua valendo por cima.
 */

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NotificationCategoryPolicy } from '@adatechnology/notification-contracts'

import { useNotificationContext } from '../NotificationProvider'
import { NOTIFICATION_QUERY_KEYS } from './queryKeys'

export type UseCategoryPoliciesResult = {
  readonly isLoading: boolean
  readonly isSaving: boolean
  readonly error: string | undefined
  readonly isDirty: boolean
  /** Linha ausente é permitido — o mesmo default do servidor, para a tela não mentir. */
  isAllowed: (params: { category: string; channel: string }) => boolean
  toggle: (params: { category: string; channel: string }) => void
  save: () => void
  reset: () => void
}

function identityOf(params: { category: string; channel: string }): string {
  return `${params.category}:${params.channel}`
}

export function useCategoryPolicies(): UseCategoryPoliciesResult {
  const { client } = useNotificationContext()
  const queryClient = useQueryClient()

  const policiesQuery = useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.categoryPolicies(),
    queryFn: () => client.getCategoryPolicies(),
  })

  const mutation = useMutation({
    mutationFn: (policies: readonly NotificationCategoryPolicy[]) => client.updateCategoryPolicies(policies),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.categoryPolicies() })
    },
  })

  /**
   * O rascunho guarda só o que foi TOCADO, não uma cópia do conjunto inteiro. Com a cópia, salvar
   * gravaria linha para toda combinação exibida na tela — e a ausência de linha, que é o default
   * "permitido", viraria centenas de registros de `enabled: true` sem significado.
   */
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const saved = useMemo(() => {
    const byIdentity = new Map<string, boolean>()
    for (const policy of policiesQuery.data ?? []) byIdentity.set(identityOf(policy), policy.enabled)
    return byIdentity
  }, [policiesQuery.data])

  function isAllowed(params: { category: string; channel: string }): boolean {
    const identity = identityOf(params)
    return touched[identity] ?? saved.get(identity) ?? true
  }

  return {
    isLoading: policiesQuery.isLoading,
    isSaving: mutation.isPending,
    error: mutation.error?.message,
    isDirty: Object.keys(touched).length > 0,
    isAllowed,

    toggle(params) {
      const identity = identityOf(params)
      setTouched((current) => ({ ...current, [identity]: !isAllowed(params) }))
    },

    save() {
      // Só as categorias tocadas vão no corpo: o servidor substitui categoria a categoria, e
      // mandar o conjunto inteiro apagaria e reescreveria política que ninguém editou.
      const categories = new Set(Object.keys(touched).map((identity) => identity.split(':')[0] ?? ''))
      const policies: NotificationCategoryPolicy[] = []
      for (const category of categories) {
        const channels = new Set([
          ...[...saved.keys()].filter((identity) => identity.startsWith(`${category}:`)),
          ...Object.keys(touched).filter((identity) => identity.startsWith(`${category}:`)),
        ])
        for (const identity of channels) {
          const channel = identity.slice(category.length + 1)
          policies.push({
            category,
            channel: channel as NotificationCategoryPolicy['channel'],
            enabled: isAllowed({ category, channel }),
          })
        }
      }
      mutation.mutate(policies, { onSuccess: () => setTouched({}) })
    },

    reset() {
      setTouched({})
    },
  }
}
