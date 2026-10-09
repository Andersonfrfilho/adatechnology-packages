import type { ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { buildConversation, buildMessage } from './participantFixtures.test-helper'

/** The components under comparison are injected so the same scenarios render against any checkout. */
export type GoldenComponents = {
  readonly ParticipantThread: ComponentType<Record<string, unknown>>
  readonly ParticipantConversations: ComponentType<Record<string, unknown>>
  readonly labels: unknown
}

const NOOP = (): void => undefined
const SUBJECT_GROUPS = [{ subjectType: 'invoice', label: 'Invoices' }]

const ITEMS = [
  { kind: 'server', message: buildMessage({ id: 'a', direction: 'inbound', authorName: 'Ana Souza', text: '**oi** 11 98888-7777 a@b.com https://x.com', createdAt: '2026-10-01T12:00:00.000Z' }) },
  { kind: 'server', message: buildMessage({ id: 'b', direction: 'outbound', authorName: 'Op', status: 'read', createdAt: '2026-10-01T12:05:00.000Z' }) },
  { kind: 'server', message: buildMessage({ id: 'b2', direction: 'inbound', status: 'delivered', createdAt: '2026-10-02T12:05:00.000Z' }) },
  { kind: 'pending', origin: 'local', displayState: 'failed', pending: { clientMessageId: 'c', subject: { subjectType: 'invoice', subjectId: '1' }, text: 'W', createdAt: '2026-10-02T12:06:00.000Z', state: 'failed' } },
]

function buildThreadProps(labels: unknown): Record<string, unknown> {
  return {
    conversation: buildConversation({ subjectId: '1', subjectLabel: 'Invoice 4521', protocol: 'P-1', channels: ['app', 'whatsapp'] }),
    items: ITEMS, hasMore: true, onLoadOlder: NOOP, labels, resolveAttachmentUrl: async () => 'x',
    draft: { value: 'abc', onChange: NOOP, files: [], onFilesChange: NOOP }, onSend: NOOP, status: 'ready', refresh: NOOP,
    scroll: { ref: { current: null }, onScroll: NOOP, isAwayFromBottom: true, scrollToLatest: NOOP },
    newMessagesCount: 2, isSending: false, onBack: NOOP,
    pendingActions: { retryLocal: NOOP, discardLocal: NOOP, editLocal: NOOP },
    quickReplies: [{ id: '1', title: 'T', shortcut: 't', body: 'b' }],
  }
}

const THREAD_VARIANTS: Record<string, Record<string, unknown>> = {
  'thread-default': {},
  'thread-plain': { hasMore: false, newMessagesCount: 0, quickReplies: [], scroll: { ref: { current: null }, onScroll: NOOP, isAwayFromBottom: false, scrollToLatest: NOOP }, items: ITEMS.slice(0, 2) },
  'thread-avatars-initials': { avatars: 'initials' },
  'thread-tail-off': { tail: false },
  'thread-error': { status: 'error', items: [] },
  'thread-loading': { status: 'loading', items: [] },
  'thread-closed': { conversation: buildConversation({ subjectId: '2', status: 'closed' }) },
}

export function renderGoldenScenarios({ ParticipantThread, ParticipantConversations, labels }: GoldenComponents): Record<string, string> {
  const base = buildThreadProps(labels)
  const html: Record<string, string> = {}
  for (const [name, extra] of Object.entries(THREAD_VARIANTS)) {
    html[name] = renderToStaticMarkup(<ParticipantThread {...base} {...extra} />)
  }
  const api = { listConversations: async () => ({ data: [] }), fetchMessages: async () => [], sendMessage: async () => ({ outcome: 'queued' }), markRead: async () => undefined, resolveAttachmentUrl: async () => 'x' }
  html['conversations-list'] = renderToStaticMarkup(<ParticipantConversations api={api} subjectGroups={SUBJECT_GROUPS} />)
  html['conversations-selected'] = renderToStaticMarkup(
    <ParticipantConversations api={api} subjectGroups={SUBJECT_GROUPS} selected={{ subjectType: 'invoice', subjectId: '1' }} />,
  )
  return html
}
