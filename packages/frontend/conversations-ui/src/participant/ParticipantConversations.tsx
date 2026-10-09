import type { ReactNode } from 'react'

import type {
  ParticipantConversationSummary,
  ParticipantSubjectRef,
} from '@adatechnology/conversation-contracts'

import type { ConversationChannel } from '../conversationChannel'
import type { QuickReply } from '../quickReplies/quickReply.types'
import type { ConversationsTheme } from '../types'
import { ParticipantConversationsScreen } from './ParticipantConversationsScreen'
import type { ParticipantConversationsClassNames, ParticipantSubjectGroup } from './participant.types'
import type { ParticipantConversationsApi, ParticipantPendingMessage } from './participantApi.types'
import type { ParticipantConversationsLabels } from './participantLabels'
import { useParticipantInbox } from './useParticipantInbox'

export type ParticipantConversationsProps = {
  api: ParticipantConversationsApi
  subjectGroups: readonly ParticipantSubjectGroup[]
  /** undefined renders the list; defined renders that conversation. */
  selected: ParticipantSubjectRef | undefined
  onSelect: (subject: ParticipantSubjectRef) => void
  onBack?: () => void
  channel?: ConversationChannel
  labels?: Partial<ParticipantConversationsLabels>
  locale?: string
  theme?: ConversationsTheme
  className?: string
  classNames?: Partial<ParticipantConversationsClassNames>
  pendingMessages?: readonly ParticipantPendingMessage[]
  onRetryPending?: (clientMessageId: string) => void
  quickReplies?: readonly QuickReply[]
  renderSubjectCard?: (conversation: ParticipantConversationSummary) => ReactNode
  onOpenSubject?: (subject: ParticipantSubjectRef) => void
}

export function ParticipantConversations(props: ParticipantConversationsProps) {
  const inbox = useParticipantInbox(props.api)
  const { status, conversations, hasMore, refresh, loadMore, markSubjectRead } = inbox

  return <ParticipantConversationsScreen {...props} inbox={{ status, conversations, hasMore, refresh, loadMore, markSubjectRead }} />
}
