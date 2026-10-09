import type { ParticipantTimelineItem } from './participantMessages'

export function collectServerMessageIds(items: readonly ParticipantTimelineItem[]): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const item of items) {
    if (item.kind === 'server') ids.add(item.message.id)
  }
  return ids
}

/** Messages from the other side ('outbound') that the participant has not seen yet. */
export function countNewIncomingMessages(previousIds: ReadonlySet<string>, currentItems: readonly ParticipantTimelineItem[]): number {
  return currentItems.filter(
    (item) => item.kind === 'server' && item.message.direction === 'outbound' && !previousIds.has(item.message.id),
  ).length
}
