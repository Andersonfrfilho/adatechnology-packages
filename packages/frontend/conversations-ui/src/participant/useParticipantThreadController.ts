import { useMemo, type Dispatch, type MutableRefObject } from 'react'

import type { ParticipantConversationSummary, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import type { ConversationChannel } from '../conversationChannel'
import type { ParticipantThreadProps } from './ParticipantThread'
import { bindAttachmentUrlResolver } from './bindAttachmentUrlResolver'
import type { ParticipantConversationsApi, ParticipantPendingMessage } from './participantApi.types'
import type { ParticipantDrafts } from './participantDrafts'
import type { ParticipantConversationsLabels } from './participantLabels'
import type { ParticipantPerspective } from './participantPerspective'
import { findFailedEntry, hasSendingEntry, type ParticipantSendAction } from './participantSendController'
import type { ParticipantSendStates, ParticipantSendStatesAction } from './participantSendStates'
import { useParticipantConversationView } from './useParticipantConversationView'
import { useParticipantDraft } from './useParticipantDraft'
import { useParticipantThread, type UseParticipantThreadResult } from './useParticipantThread'
import { useParticipantThreadScroll } from './useParticipantThreadScroll'

export type ParticipantThreadControllerParams = {
  readonly api: ParticipantConversationsApi
  readonly subject: ParticipantSubjectRef
  readonly conversation: ParticipantConversationSummary
  readonly labels: ParticipantConversationsLabels
  /** Holds the immutable drafts of every subject; replaced, never mutated. */
  readonly draftsRef: MutableRefObject<ParticipantDrafts>
  readonly sendStates: ParticipantSendStates
  readonly dispatchSendStates: Dispatch<ParticipantSendStatesAction>
  readonly onMarkedRead: (subject: ParticipantSubjectRef) => void
  readonly channel?: ConversationChannel
  readonly locale?: string
  readonly pendingMessages?: readonly ParticipantPendingMessage[]
  readonly onRetryPending?: (clientMessageId: string) => void
  readonly perspective?: ParticipantPerspective
}

/** Everything a conversation screen needs from the hooks; the caller adds only its own presentation props. */
export type ParticipantThreadCoreProps = Pick<
  ParticipantThreadProps,
  | 'conversation'
  | 'items'
  | 'hasMore'
  | 'labels'
  | 'resolveAttachmentUrl'
  | 'draft'
  | 'onSend'
  | 'status'
  | 'refresh'
  | 'scroll'
  | 'newMessagesCount'
  | 'isSending'
  | 'channel'
  | 'locale'
  | 'onLoadOlder'
  | 'pendingActions'
  | 'perspective'
>

type BuildPendingActionsParams = {
  readonly thread: UseParticipantThreadResult
  readonly dispatchSend: (action: ParticipantSendAction) => void
  readonly handleEdit: (clientMessageId: string) => void
  readonly onRetryPending: ParticipantThreadControllerParams['onRetryPending']
}

function buildPendingActions({ thread, dispatchSend, handleEdit, onRetryPending }: BuildPendingActionsParams): ParticipantThreadCoreProps['pendingActions'] {
  return {
    retryLocal: (clientMessageId) => void thread.retry(clientMessageId),
    discardLocal: (clientMessageId) => dispatchSend({ type: 'discarded', clientMessageId }),
    editLocal: handleEdit,
    ...(onRetryPending ? { retryHost: onRetryPending } : {}),
  }
}

export function useParticipantThreadController(params: ParticipantThreadControllerParams): ParticipantThreadCoreProps {
  const { api, subject, conversation, draftsRef } = params
  const { draft, setText, setFiles, takeForSend, restoreFromEntry } = useParticipantDraft(draftsRef, subject)
  const { thread, items, sendEntries, dispatchSend } = useParticipantConversationView(params)
  const resolveAttachmentUrl = useMemo(() => bindAttachmentUrlResolver(api), [api])
  const { scroll, newMessagesCount } = useParticipantThreadScroll(items, params.perspective)

  function handleSend(): void {
    const content = takeForSend()
    if (content) void thread.send(content)
  }

  function handleEdit(clientMessageId: string): void {
    const entry = findFailedEntry(sendEntries, clientMessageId)
    if (!entry) return
    restoreFromEntry(entry)
    dispatchSend({ type: 'discarded', clientMessageId })
  }

  return {
    conversation,
    items,
    hasMore: thread.hasMore,
    labels: params.labels,
    resolveAttachmentUrl,
    draft: { value: draft.text, onChange: setText, files: draft.files, onFilesChange: setFiles },
    onSend: handleSend,
    status: thread.status,
    refresh: () => void thread.refresh(),
    scroll,
    newMessagesCount,
    isSending: hasSendingEntry(sendEntries),
    channel: params.channel,
    locale: params.locale,
    onLoadOlder: () => void thread.loadOlder(),
    pendingActions: buildPendingActions({ thread, dispatchSend, handleEdit, onRetryPending: params.onRetryPending }),
    perspective: params.perspective,
  }
}
