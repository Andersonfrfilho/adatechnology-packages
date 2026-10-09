import type { ReactNode } from 'react'

import type { ParticipantConversationSummary } from '@adatechnology/conversation-contracts'

import type { ParticipantSubjectGroup, ParticipantSubjectIconRenderer } from './participant.types'

export type ResolveConversationIconParams = {
  readonly conversation: ParticipantConversationSummary
  readonly group: ParticipantSubjectGroup | undefined
  readonly renderSubjectIcon?: ParticipantSubjectIconRenderer
}

export function isDrawable(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false && node !== ''
}

/** Host icon, then group icon, then nothing; the list row adds its own text fallback, the header draws no tile. */
export function resolveConversationIcon({
  conversation,
  group,
  renderSubjectIcon,
}: ResolveConversationIconParams): ReactNode | undefined {
  const custom = renderSubjectIcon?.(conversation)
  if (isDrawable(custom)) return custom
  return isDrawable(group?.icon) ? group?.icon : undefined
}
