import type { ParticipantConversationSummary } from '@adatechnology/conversation-contracts'

/** Search appears when the list is long even if no conversation carries a protocol. */
export const PROTOCOL_SEARCH_CONVERSATION_THRESHOLD = 8

export function normalizeProtocolQuery(text: string): string {
  return text.replace(/[-\s]/g, '').toUpperCase()
}

export function matchesProtocolQuery(protocol: string | undefined, query: string): boolean {
  const normalizedQuery = normalizeProtocolQuery(query)
  if (normalizedQuery === '') return true
  if (protocol === undefined) return false
  return normalizeProtocolQuery(protocol).includes(normalizedQuery)
}

function foldText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function matchesTitle(subjectLabel: string, query: string): boolean {
  return foldText(subjectLabel).includes(foldText(query))
}

export function filterConversationsBySearch(
  conversations: readonly ParticipantConversationSummary[],
  query: string,
): readonly ParticipantConversationSummary[] {
  const trimmedQuery = query.trim()
  if (trimmedQuery === '') return conversations
  const hasProtocolTerm = normalizeProtocolQuery(trimmedQuery) !== ''
  return conversations.filter(
    (conversation) =>
      matchesTitle(conversation.subjectLabel, trimmedQuery) ||
      (hasProtocolTerm && matchesProtocolQuery(conversation.protocol, trimmedQuery)),
  )
}

export function shouldShowInboxSearch(conversations: readonly ParticipantConversationSummary[]): boolean {
  if (conversations.length > PROTOCOL_SEARCH_CONVERSATION_THRESHOLD) return true
  return conversations.some((conversation) => conversation.protocol !== undefined)
}
