import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { ParticipantMessageActionsTarget } from './ParticipantAuthorAvatar'
import type { ParticipantConversationsLabels } from './participantLabels'
import { isOwnMessage, type ParticipantTimelineItem } from './participantMessages'
import { toggleSelectedId, type ParticipantMessageMenuOptions } from './participantMessageMenuModel'
import type { ParticipantPerspective } from './participantPerspective'

export type ParticipantMessageMenuState = {
  readonly options: ParticipantMessageMenuOptions
  readonly labels: ParticipantConversationsLabels
  readonly locale?: string
  /** Server messages of the thread, in conversation order: what the selection bar acts on. */
  readonly messages: readonly ParticipantMessageActionsTarget[]
  readonly selectedIds: readonly string[]
  readonly isSelecting: boolean
  /** Enters selection mode with this message already checked. */
  readonly start: (id: string) => void
  readonly toggle: (id: string) => void
  readonly clear: () => void
}

const MessageMenuContext = createContext<ParticipantMessageMenuState | null>(null)

/** Null when the host did not opt in: the bubble stays as it was. */
export function useParticipantMessageMenu(): ParticipantMessageMenuState | null {
  return useContext(MessageMenuContext)
}

export function toMessageTargets(
  items: readonly ParticipantTimelineItem[],
  perspective?: ParticipantPerspective,
): readonly ParticipantMessageActionsTarget[] {
  return items.flatMap((item) =>
    item.kind === 'server'
      ? [
          {
            id: item.message.id,
            text: item.message.text ?? null,
            authorName: item.message.authorName ?? null,
            isMine: isOwnMessage(item.message, perspective),
            attachments: item.message.attachments,
            createdAt: item.message.createdAt,
          },
        ]
      : [],
  )
}

type ProviderProps = {
  readonly options?: ParticipantMessageMenuOptions
  readonly labels: ParticipantConversationsLabels
  readonly locale?: string
  readonly items: readonly ParticipantTimelineItem[]
  readonly perspective?: ParticipantPerspective
  readonly children: ReactNode
}

/** Holds the selection of one thread; Escape leaves selection mode, as in any system selection. */
export function ParticipantMessageMenuProvider({ options, labels, locale, items, perspective, children }: ProviderProps) {
  const [selection, setSelection] = useState<{ readonly isSelecting: boolean; readonly ids: readonly string[] }>({
    isSelecting: false,
    ids: [],
  })
  const clear = useCallback(() => setSelection({ isSelecting: false, ids: [] }), [])
  const start = useCallback((id: string) => setSelection({ isSelecting: true, ids: [id] }), [])
  const toggle = useCallback(
    (id: string) => setSelection((current) => ({ ...current, ids: toggleSelectedId(current.ids, id) })),
    [],
  )
  const messages = useMemo(() => toMessageTargets(items, perspective), [items, perspective])

  useEffect(() => {
    if (!selection.isSelecting) return undefined
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') clear()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selection.isSelecting, clear])

  const value = useMemo<ParticipantMessageMenuState | null>(
    () =>
      options
        ? {
            options,
            labels,
            locale,
            messages,
            selectedIds: selection.ids,
            isSelecting: selection.isSelecting,
            start,
            toggle,
            clear,
          }
        : null,
    [options, labels, locale, messages, selection, start, toggle, clear],
  )
  return <MessageMenuContext.Provider value={value}>{children}</MessageMenuContext.Provider>
}
