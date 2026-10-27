import type { ParticipantConversationSummary } from '@adatechnology/conversation-contracts'

import type {
  GroupParticipantConversationsParams,
  ParticipantInboxFilter,
  ParticipantInboxSection,
  ParticipantInboxView,
} from './participant.types'
import { filterConversationsBySearch } from './participantProtocol'

const ALL_FILTER = 'all'
const SECTION_AWAITING = 'awaiting'
const SECTION_OTHER = 'other'
const SECTION_CLOSED = 'closed'

function compareConversations(left: ParticipantConversationSummary, right: ParticipantConversationSummary): number {
  if (left.lastMessageAt !== right.lastMessageAt) {
    if (left.lastMessageAt === null) return 1
    if (right.lastMessageAt === null) return -1
    return left.lastMessageAt < right.lastMessageAt ? 1 : -1
  }
  return left.subjectLabel.localeCompare(right.subjectLabel)
}

function sumUnread(conversations: readonly ParticipantConversationSummary[]): number {
  return conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0)
}

function resolveSectionKey(conversation: ParticipantConversationSummary, knownTypes: ReadonlySet<string>): string {
  if (conversation.status === 'closed') return SECTION_CLOSED
  if (conversation.awaitingParticipant) return SECTION_AWAITING
  return knownTypes.has(conversation.subjectType) ? conversation.subjectType : SECTION_OTHER
}

function buildSection(key: string, conversations: readonly ParticipantConversationSummary[]): ParticipantInboxSection {
  const sorted = [...conversations].sort(compareConversations)
  return { key, conversations: sorted, unreadCount: sumUnread(sorted) }
}

function buildFilters(
  params: GroupParticipantConversationsParams,
): Pick<ParticipantInboxView, 'filters' | 'showFilters'> {
  const groupFilters: ParticipantInboxFilter[] = []
  for (const group of params.subjectGroups) {
    const own = params.conversations.filter((conversation) => conversation.subjectType === group.subjectType)
    if (own.length === 0) continue
    groupFilters.push({ subjectType: group.subjectType, label: group.label, unreadCount: sumUnread(own) })
  }
  const all: ParticipantInboxFilter = {
    subjectType: ALL_FILTER,
    label: 'All',
    unreadCount: sumUnread(params.conversations),
  }
  return { filters: [all, ...groupFilters], showFilters: groupFilters.length >= 2 }
}

function resolveActiveFilter(params: GroupParticipantConversationsParams): string {
  const { filter, conversations } = params
  if (filter === undefined || filter === ALL_FILTER) return ALL_FILTER
  return conversations.some((conversation) => conversation.subjectType === filter) ? filter : ALL_FILTER
}

export function groupParticipantConversations(params: GroupParticipantConversationsParams): ParticipantInboxView {
  const { subjectGroups } = params
  const filter = resolveActiveFilter(params)
  const isFiltered = filter !== ALL_FILTER
  const searched = filterConversationsBySearch(params.conversations, params.searchQuery ?? '')
  const visible = isFiltered ? searched.filter((conversation) => conversation.subjectType === filter) : searched
  const knownTypes = new Set(subjectGroups.map((group) => group.subjectType))

  const buckets = new Map<string, ParticipantConversationSummary[]>()
  for (const conversation of visible) {
    const key = resolveSectionKey(conversation, knownTypes)
    buckets.set(key, [...(buckets.get(key) ?? []), conversation])
  }

  const orderedKeys = [
    SECTION_AWAITING,
    ...subjectGroups.map((group) => group.subjectType),
    SECTION_OTHER,
    SECTION_CLOSED,
  ]
  const sections = orderedKeys.flatMap((key) => {
    const bucket = buckets.get(key)
    return bucket === undefined ? [] : [buildSection(key, bucket)]
  })

  const hasMatchesOutsideFilter = isFiltered && visible.length === 0 && searched.length > 0
  return { sections, hasMatchesOutsideFilter, activeFilter: filter, ...buildFilters(params) }
}
