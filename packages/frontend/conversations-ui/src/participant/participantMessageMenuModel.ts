import type { ParticipantMessageActionsTarget } from './ParticipantAuthorAvatar'

/** One entry the host adds to a message's menu, after the package's own (copy, select). */
export type ParticipantMessageMenuItem = {
  readonly id: string
  readonly label: string
  /** Runs on choice; the menu closes first. */
  readonly onSelect?: () => void
  /** Draws the entry as a link (a file to open or save) instead of a button. */
  readonly href?: string
  /** With `href`: the file name the browser saves it under. */
  readonly download?: string
  readonly disabled?: boolean
}

/** One button the host adds to the selection bar; it receives the selected messages in conversation order. */
export type ParticipantSelectionAction = {
  readonly id: string
  readonly label: string
  readonly onSelect: (messages: readonly ParticipantMessageActionsTarget[]) => void
  readonly disabled?: boolean
}

/**
 * Opt-in message menu, as in common chat apps: a discreet chevron on the bubble (or a right-click, or a long
 * press) opens Copy and Select messages, plus the host's entries. Absent leaves the bubble as it was.
 */
export type ParticipantMessageMenuOptions = {
  readonly items?: (message: ParticipantMessageActionsTarget) => readonly ParticipantMessageMenuItem[]
  readonly selectionActions?: (
    messages: readonly ParticipantMessageActionsTarget[],
  ) => readonly ParticipantSelectionAction[]
}

/** Adds the id, or removes it when it is already there; keeps the rest in the order they were picked. */
export function toggleSelectedId(ids: readonly string[], id: string): readonly string[] {
  return ids.includes(id) ? ids.filter((candidate) => candidate !== id) : [...ids, id]
}

/** The selected messages in the order of the conversation, whatever order they were picked in. */
export function selectedInOrder(
  messages: readonly ParticipantMessageActionsTarget[],
  ids: readonly string[],
): readonly ParticipantMessageActionsTarget[] {
  const picked = new Set(ids)
  return messages.filter((message) => picked.has(message.id))
}

/** The trimmed text of one message, or null when there is nothing to copy (a file alone). */
export function copyableText(message: Pick<ParticipantMessageActionsTarget, 'text'>): string | null {
  const text = message.text?.trim() ?? ''
  return text === '' ? null : text
}

type CopyFormat = { readonly locale?: string; readonly meLabel: string }

function stamp(iso: string, locale?: string): string {
  const date = new Date(iso)
  const day = date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  return `${day} ${time}`
}

/** Several messages as text: one line each, `[date time] author: text [file]`, like a chat export. */
export function formatMessagesForCopy(messages: readonly ParticipantMessageActionsTarget[], format: CopyFormat): string {
  return messages
    .map((message) => {
      const author = message.isMine ? format.meLabel : (message.authorName ?? '')
      const head = `[${stamp(message.createdAt, format.locale)}]${author === '' ? '' : ` ${author}:`}`
      const files = message.attachments.map((attachment) => `[${attachment.filename}]`)
      return [head, copyableText(message) ?? '', ...files].filter((part) => part !== '').join(' ')
    })
    .join('\n')
}

/** Text the user selected, when it starts and ends inside the element; empty otherwise. */
export function selectedTextWithin(container: Element | null): string {
  const selection = typeof window === 'undefined' ? null : window.getSelection()
  if (!container || !selection || selection.isCollapsed) return ''
  const { anchorNode, focusNode } = selection
  if (!anchorNode || !focusNode || !container.contains(anchorNode) || !container.contains(focusNode)) return ''
  return selection.toString().trim()
}
