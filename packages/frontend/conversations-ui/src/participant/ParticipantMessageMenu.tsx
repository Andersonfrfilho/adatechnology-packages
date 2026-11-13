import { ChevronDown } from 'lucide-react'
import { useCallback, useId, useState } from 'react'

import type { ParticipantMessageActionsTarget } from './ParticipantAuthorAvatar'
import { downloadTextFile } from '../conversationTranscript'
import { ParticipantMessageInfo } from './ParticipantMessageInfo'
import { formatMessageMoment } from './participantMessageMoment'
import { readyTranscriptions, transcriptionFileName } from './participantTranscriptionText'
import type { ParticipantMessageMenuState } from './ParticipantMessageMenuContext'
import {
  DEFAULT_MESSAGE_OPTIONS_LABEL,
  DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS as DEFAULTS,
} from './participantLabels'
import { copyableText, type ParticipantMessageMenuItem } from './participantMessageMenuModel'
import type { ParticipantFailedMenuController } from './useParticipantFailedMenu'
import { useOpenUpwards } from './useOpenUpwards'
import { useParticipantCopyFeedback } from './useParticipantCopyFeedback'

type ParticipantMessageMenuProps = {
  readonly menu: ParticipantFailedMenuController
  readonly state: ParticipantMessageMenuState
  readonly message: ParticipantMessageActionsTarget
  /** Text the user had selected inside the bubble when the menu opened; empty when none. */
  readonly selectedText: string
  readonly onTriggerPointerDown: () => void
}

type Entry = ParticipantMessageMenuItem & { readonly run?: () => void }

/** A transcribed audio: copy what was said, or save it as a text file named after the audio. */
function transcriptionEntries(props: ParticipantMessageMenuProps, copy: (value: string) => void): readonly Entry[] {
  const { state, message } = props
  const { labels } = state
  const ready = readyTranscriptions(message.attachments)
  const [first] = ready
  if (!first) return []
  const prefix = labels.transcriptionPrefix ?? DEFAULTS.transcriptionPrefix ?? ''
  const text = ready.map((entry) => entry.text).join('\n\n')
  const author = message.isMine ? labels.me : (message.authorName ?? '')
  const head = `[${formatMessageMoment(message.createdAt, state.locale)}]${author === '' ? '' : ` ${author}`}`
  return [
    {
      id: 'copy-transcription',
      label: labels.copyTranscription ?? DEFAULTS.copyTranscription ?? '',
      run: () => copy(text),
    },
    {
      id: 'download-transcription',
      label: labels.downloadTranscription ?? DEFAULTS.downloadTranscription ?? '',
      run: () => downloadTextFile(transcriptionFileName(first.filename, prefix), `${head}\n\n${text}\n`),
    },
  ]
}

function entriesFor(
  props: ParticipantMessageMenuProps,
  copy: (value: string) => void,
  showInfo: () => void,
): readonly Entry[] {
  const { state, message, selectedText } = props
  const { labels } = state
  const text = copyableText(message)
  const own: Entry[] = []
  if (selectedText !== '' && selectedText !== text) {
    own.push({
      id: 'copy-selection',
      label: labels.copySelection ?? DEFAULTS.copySelection ?? '',
      run: () => copy(selectedText),
    })
  }
  if (text !== null)
    own.push({ id: 'copy', label: labels.copyMessage ?? DEFAULTS.copyMessage ?? '', run: () => copy(text) })
  own.push({
    id: 'select',
    label: labels.selectMessages ?? DEFAULTS.selectMessages ?? '',
    run: () => state.start(message.id),
  })
  own.push(...transcriptionEntries(props, copy))
  own.push({ id: 'info', label: labels.messageInfo ?? DEFAULTS.messageInfo ?? '', run: showInfo })
  return [...own, ...(state.options.items?.(message) ?? []).map((item) => ({ ...item, run: item.onSelect }))]
}

/** The chevron that shows on hover or focus, and the menu it opens: the package's entries (copy, select, info), then the host's. */
export function ParticipantMessageMenu(props: ParticipantMessageMenuProps) {
  const { menu, state } = props
  const triggerId = useId()
  const { copy } = useParticipantCopyFeedback()
  const label = state.labels.messageOptions ?? DEFAULT_MESSAGE_OPTIONS_LABEL
  const [isInfoOpen, setInfoOpen] = useState(false)
  const closeInfo = useCallback(() => setInfoOpen(false), [])
  const entries = entriesFor(
    props,
    (value) => copy(value, state.labels.valueCopied),
    () => setInfoOpen(true),
  )
  const isUpwards = useOpenUpwards(menu.state.isOpen, menu.menuRef)
  const listClass = `cv-p-failed-menu__list cv-p-message-menu__list${isUpwards ? ' cv-p-message-menu__list--up' : ''}`

  function choose(entry: Entry): void {
    menu.close()
    entry.run?.()
  }

  return (
    <span
      className="cv-p-message-menu"
      data-open={menu.state.isOpen || isInfoOpen ? 'true' : undefined}
      ref={menu.containerRef}
      onBlur={menu.handleBlur}
    >
      <button
        type="button"
        id={triggerId}
        ref={menu.triggerRef}
        className="cv-p-message-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={menu.state.isOpen}
        aria-label={label}
        onPointerDown={props.onTriggerPointerDown}
        onClick={menu.handleTriggerClick}
        onKeyDown={menu.handleTriggerKeyDown}
      >
        <ChevronDown size={16} aria-hidden={true} />
      </button>
      {menu.state.isOpen ? (
        <div
          role="menu"
          aria-labelledby={triggerId}
          ref={menu.menuRef}
          className={listClass}
          onKeyDown={menu.handleMenuKeyDown}
        >
          {entries.map((entry) =>
            entry.href ? (
              <a
                key={entry.id}
                role="menuitem"
                tabIndex={-1}
                className="cv-p-failed-menu__item cv-p-message-menu__item"
                href={entry.href}
                download={entry.download}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={entry.disabled ? 'true' : undefined}
                onClick={() => choose(entry)}
              >
                {entry.label}
              </a>
            ) : (
              <button
                key={entry.id}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="cv-p-failed-menu__item cv-p-message-menu__item"
                disabled={entry.disabled}
                onClick={() => choose(entry)}
              >
                {entry.label}
              </button>
            ),
          )}
        </div>
      ) : null}
      {isInfoOpen ? <ParticipantMessageInfo state={state} message={props.message} onClose={closeInfo} /> : null}
    </span>
  )
}
