import { ConversationsWorkspace } from '@adatechnology/conversations-ui'
import type { ConversationSummary, ConversationVariable } from '@adatechnology/conversations-ui'

type AttendanceScreenProps = {
  readonly conversationVariables: readonly ConversationVariable[]
}

export function AttendanceScreen({ conversationVariables }: AttendanceScreenProps) {
  function conversationVariablesFor(_conversation: ConversationSummary): readonly ConversationVariable[] {
    return conversationVariables
  }

  return <ConversationsWorkspace composer="rich" conversationVariablesFor={conversationVariablesFor} />
}
