import { useEffect, useMemo, useState } from 'react'

import type { ParticipantConversationSummary, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import { ParticipantThread } from './ParticipantThread'
import type { ParticipantConversationsScreenProps } from './ParticipantConversationsScreen'
import type { ParticipantConversationsLabels } from './participantLabels'
import { mergeParticipantMessages } from './participantMessages'
import type { ParticipantConversationsApi } from './participantApi.types'
import { useParticipantThread } from './useParticipantThread'

export type ParticipantDraft = {
  readonly value: string
  readonly files: readonly File[]
}

const EMPTY_DRAFT: ParticipantDraft = { value: '', files: [] }

export type ParticipantThreadScreenProps = Omit<ParticipantConversationsScreenProps, 'selected' | 'labels'> & {
  readonly selected: ParticipantSubjectRef
  readonly labels: ParticipantConversationsLabels
  readonly drafts: Map<string, ParticipantDraft>
  readonly draftKey: string
}

type OpenedState = { readonly status: 'idle' | 'loading' | 'missing' } | { readonly status: 'found'; readonly conversation: ParticipantConversationSummary }

function useOpenedConversation(api: ParticipantConversationsApi, subject: ParticipantSubjectRef, isNeeded: boolean): OpenedState {
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

function NotFound({ labels, onBack }: { readonly labels: ParticipantConversationsLabels; readonly onBack?: () => void }) {
  return (
    <div className="cv-p cv-p-thread">
      <header className="cv-p-thread__header">
        {onBack ? (
          <button type="button" className="cv-p-button cv-p-thread__back" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            <span className="cv-p-sr-only">{labels.back}</span>
          </button>
        ) : null}
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
  if (isResolving || (api.openConversation === undefined && isListLoading)) return <div className="cv-p cv-p-thread" aria-busy="true" />
  return <NotFound labels={labels} onBack={props.onBack} />
}

type LoadedThreadProps = ParticipantThreadScreenProps & { readonly conversation: ParticipantConversationSummary }

function LoadedThread(props: LoadedThreadProps) {
  const { api, selected, conversation, drafts, draftKey, inbox, pendingMessages } = props
  const [draft, setDraft] = useState<ParticipantDraft>(drafts.get(draftKey) ?? EMPTY_DRAFT)
  const thread = useParticipantThread({
    api,
    subject: selected,
    channel: props.channel,
    unreadCount: conversation.unreadCount,
    onMarkedRead: inbox.markSubjectRead,
  })
  const items = useMemo(
    () =>
      mergeParticipantMessages({
        serverMessages: thread.messages,
        hostPending: pendingMessages ?? [],
        localPending: thread.localPending,
        subject: selected,
      }),
    [thread.messages, thread.localPending, pendingMessages, selected],
  )

  function updateDraft(next: ParticipantDraft): void {
    setDraft(next)
    drafts.set(draftKey, next)
  }

  function handleSend(): void {
    const text = draft.value.trim()
    void thread.send({ ...(text ? { text } : {}), ...(draft.files.length > 0 ? { files: draft.files } : {}) })
    setDraft(EMPTY_DRAFT)
    drafts.delete(draftKey)
  }

  function handleRetry(clientMessageId: string): void {
    const isHostPending = pendingMessages?.some((pending) => pending.clientMessageId === clientMessageId) ?? false
    if (isHostPending) props.onRetryPending?.(clientMessageId)
    else void thread.retry(clientMessageId)
  }

  return (
    <ParticipantThread
      conversation={conversation}
      items={items}
      hasMore={thread.hasMore}
      labels={props.labels}
      resolveAttachmentUrl={api.resolveAttachmentUrl}
      draft={{
        value: draft.value,
        onChange: (value) => updateDraft({ ...draft, value }),
        files: draft.files,
        onFilesChange: (files) => updateDraft({ ...draft, files }),
      }}
      onSend={handleSend}
      channel={props.channel}
      locale={props.locale}
      onBack={props.onBack}
      onOpenSubject={props.onOpenSubject}
      onLoadOlder={() => void thread.loadOlder()}
      onRetryPending={handleRetry}
      quickReplies={props.quickReplies}
      renderSubjectCard={props.renderSubjectCard}
    />
  )
}
