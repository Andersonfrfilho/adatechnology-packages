import type { ReactNode } from 'react'

import type { ParticipantConversationSummary } from '@adatechnology/conversation-contracts'

import type { ParticipantSubjectGroup, ParticipantSubjectIconRenderer } from './participant.types'

export type ResolveConversationIconParams = {
  readonly conversation: ParticipantConversationSummary
  readonly group: ParticipantSubjectGroup | undefined
  readonly renderSubjectIcon?: ParticipantSubjectIconRenderer
}

function isDrawable(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false && node !== ''
}

/** Same precedence as the list row: the host icon, then the group icon, then nothing. */
export function resolveConversationIcon({
  conversation,
  group,
  renderSubjectIcon,
}: ResolveConversationIconParams): ReactNode | undefined {
  const custom = renderSubjectIcon?.(conversation)
  if (isDrawable(custom)) return custom
  return isDrawable(group?.icon) ? group?.icon : undefined
}
