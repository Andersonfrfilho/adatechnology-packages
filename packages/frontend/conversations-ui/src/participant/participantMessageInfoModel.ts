import type { MessageDeliveryStatus } from '@adatechnology/conversation-contracts'

import type { ParticipantMessageActionsTarget } from './ParticipantAuthorAvatar'
import {
  DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS as DEFAULTS,
  type ParticipantConversationsLabels,
} from './participantLabels'
import { formatMessagesForCopy } from './participantMessageMenuModel'
import { formatMessageMoment } from './participantMessageMoment'

export type ParticipantMessageInfoRow = { readonly id: string; readonly label: string; readonly value: string }

function statusLabel(status: MessageDeliveryStatus, labels: ParticipantConversationsLabels): string {
  const byStatus: Record<MessageDeliveryStatus, string> = {
    queued: labels.statusQueued,
    sent: labels.statusSent,
    delivered: labels.statusDelivered,
    read: labels.statusRead,
    failed: labels.statusFailedShort,
    bounced: labels.statusFailedShort,
  }
  return byStatus[status]
}

/**
 * What the info panel lists: who wrote it and when; for a message this side sent, also how far it got and
 * when it was read, as far as the channel told. Nothing is invented: an unknown step is left out.
 */
export function messageInfoRows(
  message: ParticipantMessageActionsTarget,
  labels: ParticipantConversationsLabels,
  locale?: string,
): readonly ParticipantMessageInfoRow[] {
  const author = message.isMine ? labels.me : (message.authorName ?? '')
  const rows: ParticipantMessageInfoRow[] = []
  if (author !== '') rows.push({ id: 'author', label: labels.infoAuthor ?? DEFAULTS.infoAuthor ?? '', value: author })
  rows.push({
    id: 'sent',
    label: labels.infoSentAt ?? DEFAULTS.infoSentAt ?? '',
    value: formatMessageMoment(message.createdAt, locale),
  })
  if (!message.isMine) return rows
  if (message.status) {
    rows.push({
      id: 'status',
      label: labels.infoStatus ?? DEFAULTS.infoStatus ?? '',
      value: statusLabel(message.status, labels),
    })
  }
  if (message.readAt) {
    rows.push({
      id: 'read',
      label: labels.infoReadAt ?? DEFAULTS.infoReadAt ?? '',
      value: formatMessageMoment(message.readAt, locale),
    })
  }
  return rows
}

type ConversationExport = {
  readonly title: string
  readonly messages: readonly ParticipantMessageActionsTarget[]
  readonly locale?: string
  readonly meLabel: string
}

/** The conversation as a text file: the title, a blank line, then one `[date time] author: text` line each. */
export function conversationExportText({ title, messages, locale, meLabel }: ConversationExport): string {
  return `${title}\n\n${formatMessagesForCopy(messages, { locale, meLabel })}\n`
}

/** A file name any system accepts, from the conversation title. */
export function conversationExportFileName(title: string): string {
  const safe = title
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `${safe === '' ? 'conversation' : safe}.txt`
}

/** Saves text as a file through a temporary link; does nothing where the browser cannot. */
export function downloadTextFile(fileName: string, text: string): void {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
