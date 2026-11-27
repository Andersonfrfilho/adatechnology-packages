/**
 * Carrega as mensagens prontas do host (`listQuickReplies`) e mostra a faixa do topo da conversa.
 * Sem a capacidade na porta, nada aparece: um botão que abre uma lista sempre vazia não ajuda.
 */

import { useEffect, useState, type ReactNode } from 'react'

import { applyQuickReplyVariables } from '../MessageComposer'
import { QuickRepliesBar, type QuickRepliesBarLabels } from './QuickRepliesBar'
import type { QuickReply } from './quickReply.types'

export interface ConversationQuickRepliesBarProps {
  readonly conversationId: string
  readonly listQuickReplies?: ((params?: { search?: string }) => Promise<QuickReply[]>) | undefined
  readonly variables?: Readonly<Record<string, string>> | undefined
  readonly maxVisible?: number | undefined
  readonly isDisabled?: boolean | undefined
  readonly labels?: Partial<QuickRepliesBarLabels> | undefined
  /** Recebe o texto já com as variáveis aplicadas; o host o põe no campo, sem enviar. */
  readonly onInsert: (text: string, quickReply: QuickReply) => void
}

export function ConversationQuickRepliesBar({ conversationId, listQuickReplies, variables, maxVisible, isDisabled, labels, onInsert }: ConversationQuickRepliesBarProps): ReactNode {
  const [items, setItems] = useState<readonly QuickReply[]>([])

  useEffect(() => {
    if (!listQuickReplies) return undefined
    let isCurrent = true
    listQuickReplies().then(
      (loaded) => { if (isCurrent) setItems(loaded) },
      () => { if (isCurrent) setItems([]) },
    )
    return () => { isCurrent = false }
  }, [conversationId, listQuickReplies])

  return (
    <QuickRepliesBar
      items={items}
      {...(maxVisible === undefined ? {} : { maxVisible })}
      isDisabled={isDisabled === true}
      {...(labels ? { labels } : {})}
      onSelect={(quickReply) => onInsert(applyQuickReplyVariables(quickReply.body, variables), quickReply)}
    />
  )
}
