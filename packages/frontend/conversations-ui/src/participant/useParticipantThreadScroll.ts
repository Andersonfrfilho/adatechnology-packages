import { useEffect, useRef } from 'react'

import { collectServerMessageIds, countNewIncomingMessages } from './participantNewMessages'
import type { ParticipantTimelineItem } from './participantMessages'
import { useStickToBottom, type ParticipantThreadScroll } from './useStickToBottom'

export type UseParticipantThreadScrollResult = {
  readonly scroll: ParticipantThreadScroll
  readonly newMessagesCount: number
}

function keyOf(item: ParticipantTimelineItem | undefined): string | undefined {
  if (!item) return undefined
  return item.kind === 'server' ? item.message.id : `pending:${item.pending.clientMessageId}`
}

export function useParticipantThreadScroll(items: readonly ParticipantTimelineItem[]): UseParticipantThreadScrollResult {
  const { scroll, isNearBottom } = useStickToBottom({ firstKey: keyOf(items[0]), lastKey: keyOf(items[items.length - 1]) })
  const seenIds = useRef<ReadonlySet<string>>(new Set())

  useEffect(() => {
    if (isNearBottom) seenIds.current = collectServerMessageIds(items)
  }, [isNearBottom, items])

  return { scroll, newMessagesCount: isNearBottom ? 0 : countNewIncomingMessages(seenIds.current, items) }
}
