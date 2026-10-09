import type { ParticipantTimelineItem } from './participantMessages'

export function collectServerMessageIds(items: readonly ParticipantTimelineItem[]): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const item of items) {
    if (item.kind === 'server') ids.add(item.message.id)
  }
  return ids
}

function latestSeenTime(previousIds: ReadonlySet<string>, items: readonly ParticipantTimelineItem[]): number {
  let latest = Number.NEGATIVE_INFINITY
  for (const item of items) {
    if (item.kind === 'server' && previousIds.has(item.message.id)) latest = Math.max(latest, Date.parse(item.message.createdAt))
  }
  return latest
}

/** Messages from the other side ('outbound') newer than what the participant has seen; older history loaded above is not news. */
export function countNewIncomingMessages(previousIds: ReadonlySet<string>, currentItems: readonly ParticipantTimelineItem[]): number {
  const latestSeen = latestSeenTime(previousIds, currentItems)
  return currentItems.filter(
    (item) =>
      item.kind === 'server' &&
      item.message.direction === 'outbound' &&
      !previousIds.has(item.message.id) &&
      Date.parse(item.message.createdAt) > latestSeen,
  ).length
}
