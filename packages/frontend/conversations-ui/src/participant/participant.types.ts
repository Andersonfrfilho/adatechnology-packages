import type { ReactNode } from 'react'

import type { ParticipantConversationSummary } from '@adatechnology/conversation-contracts'

export type ParticipantSubjectGroup = {
  readonly subjectType: string
  readonly label: string
  readonly icon?: ReactNode
}

/** Host-drawn icon for a list row; null/undefined falls back to the subject group icon. */
export type ParticipantSubjectIconRenderer = (conversation: ParticipantConversationSummary) => ReactNode

export type ParticipantInboxSection = {
  /** 'awaiting' | 'closed' | 'other' or the subjectType of a group. */
  readonly key: string
  /** Absent for groups: the host resolves it from subjectGroups. */
  readonly label?: string
  readonly conversations: readonly ParticipantConversationSummary[]
  readonly unreadCount: number
}

export type ParticipantInboxFilter = {
  readonly subjectType: string
  readonly label: string
  readonly unreadCount: number
}

export type ParticipantInboxView = {
  readonly sections: readonly ParticipantInboxSection[]
  readonly filters: readonly ParticipantInboxFilter[]
  readonly showFilters: boolean
  /** The search finds conversations, but none under the active subject filter. */
  readonly hasMatchesOutsideFilter: boolean
}

export type GroupParticipantConversationsParams = {
  readonly conversations: readonly ParticipantConversationSummary[]
  readonly subjectGroups: readonly ParticipantSubjectGroup[]
  /** subjectType, or 'all'/undefined for everything. */
  readonly filter?: string
  /** Narrows the rows only: chips and their counts always describe the whole list. */
  readonly searchQuery?: string
}

export type ParticipantConversationsClassNames = {
  readonly root: string
  readonly inbox: string
  readonly thread: string
}
