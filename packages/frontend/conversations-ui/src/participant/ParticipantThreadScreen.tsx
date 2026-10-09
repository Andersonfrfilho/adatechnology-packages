import { useEffect, useMemo, useState, type Dispatch, type MutableRefObject } from 'react'

import type { ParticipantConversationSummary, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import { ParticipantBackButton } from './ParticipantBackButton'
import { ParticipantThread } from './ParticipantThread'
import type { ParticipantConversationsScreenProps } from './ParticipantConversationsScreen'
import { bindAttachmentUrlResolver } from './bindAttachmentUrlResolver'
import type { ParticipantDrafts } from './participantDrafts'
import type { ParticipantConversationsLabels } from './participantLabels'
import type { ParticipantConversationsApi } from './participantApi.types'
import { findFailedEntry, hasSendingEntry } from './participantSendController'
import type { ParticipantSendStates, ParticipantSendStatesAction } from './participantSendStates'
import { useParticipantDraft } from './useParticipantDraft'
import { useParticipantConversationView } from './useParticipantConversationView'
import { useParticipantThreadScroll } from './useParticipantThreadScroll'

export type ParticipantThreadScreenProps = Omit<ParticipantConversationsScreenProps, 'selected' | 'labels'> & {
  readonly selected: ParticipantSubjectRef
  readonly labels: ParticipantConversationsLabels
  /** Holds the immutable drafts of every subject; replaced, never mutated. */
  readonly draftsRef: MutableRefObject<ParticipantDrafts>
  /** Sends of every subject; they live above the conversation so a failed message survives leaving it. */
  readonly sendStates: ParticipantSendStates
  readonly dispatchSendStates: Dispatch<ParticipantSendStatesAction>
}

type OpenedState =
  | { readonly status: 'idle' | 'loading' | 'missing' }
  | { readonly status: 'found'; readonly conversation: ParticipantConversationSummary }

function useOpenedConversation(
  api: ParticipantConversationsApi,
  subject: ParticipantSubjectRef,
  isNeeded: boolean,
): OpenedState {
  const [opened, setOpened] = useState<OpenedState>({ status: 'idle' })
  const { subjectType, subjectId } = subject
  const canOpen = api.openConversation !== undefined

  useEffect(() => {
    if (!isNeeded || !canOpen) return
    let isCurrent = true
    setOpened({ status: 'loading' })
    api.openConversation?.({ subjectType, subjectId }).then(
      (conversation) => isCurrent && setOpened({ status: 'found', conversation }),
      () => isCurrent && setOpened({ status: 'missing' }),
    )
    return () => {
      isCurrent = false
    }
  }, [api, canOpen, isNeeded, subjectType, subjectId])

  return opened
}

function NotFound({
  labels,
  onBack,
}: {
  readonly labels: ParticipantConversationsLabels
  readonly onBack?: () => void
}) {
  return (
    <div className="cv-p cv-p-thread">
      <header className="cv-p-thread__header">
        {onBack ? <ParticipantBackButton label={labels.back} onBack={onBack} /> : null}
      </header>
      <p className="cv-p-empty">{labels.notFound}</p>
    </div>
  )
}

export function ParticipantThreadScreen(props: ParticipantThreadScreenProps) {
  const { api, selected, inbox, labels } = props
  const listed = inbox.conversations.find(
    (item) => item.subjectType === selected.subjectType && item.subjectId === selected.subjectId,
  )
  const opened = useOpenedConversation(api, selected, listed === undefined)
  const conversation = listed ?? (opened.status === 'found' ? opened.conversation : undefined)

  if (conversation) return <LoadedThread {...props} conversation={conversation} />
  const isResolving = opened.status === 'loading' || (api.openConversation !== undefined && opened.status === 'idle')
  const isListLoading = inbox.status === 'idle' || inbox.status === 'loading'
  if (isResolving || (api.openConversation === undefined && isListLoading))
    return <div className="cv-p cv-p-thread" aria-busy="true" />
  return <NotFound labels={labels} onBack={props.onBack} />
}

type LoadedThreadProps = ParticipantThreadScreenProps & { readonly conversation: ParticipantConversationSummary }

function LoadedThread(props: LoadedThreadProps) {
  const { api, selected, conversation, draftsRef, inbox } = props
  const { draft, setText, setFiles, takeForSend, restoreFromEntry } = useParticipantDraft(draftsRef, selected)
  const { thread, items, sendEntries, dispatchSend } = useParticipantConversationView({
    ...props,
    subject: selected,
    onMarkedRead: inbox.markSubjectRead,
  })
  const resolveAttachmentUrl = useMemo(() => bindAttachmentUrlResolver(api), [api])
  const { scroll, newMessagesCount } = useParticipantThreadScroll(items)

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

  return (
    <ParticipantThread
      conversation={conversation}
      items={items}
      hasMore={thread.hasMore}
      labels={props.labels}
      resolveAttachmentUrl={resolveAttachmentUrl}
      draft={{ value: draft.text, onChange: setText, files: draft.files, onFilesChange: setFiles }}
      onSend={handleSend}
      status={thread.status}
      refresh={() => void thread.refresh()}
      scroll={scroll}
      newMessagesCount={newMessagesCount}
      isSending={hasSendingEntry(sendEntries)}
      channel={props.channel}
      locale={props.locale}
      onBack={props.onBack}
      onOpenSubject={props.onOpenSubject}
      onLoadOlder={() => void thread.loadOlder()}
      pendingActions={{
        retryLocal: (clientMessageId) => void thread.retry(clientMessageId),
        discardLocal: (clientMessageId) => dispatchSend({ type: 'discarded', clientMessageId }),
        editLocal: handleEdit,
        ...(props.onRetryPending ? { retryHost: props.onRetryPending } : {}),
      }}
      quickReplies={props.quickReplies}
      renderSubjectCard={props.renderSubjectCard}
      subjectGroups={props.subjectGroups}
      renderSubjectIcon={props.renderSubjectIcon}
      avatars={props.avatars}
      renderAuthorAvatar={props.renderAuthorAvatar}
      tail={props.tail}
    />
  )
}
