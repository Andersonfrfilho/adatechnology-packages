import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { ParticipantMessageActionsTarget } from './ParticipantAuthorAvatar'
import type { ParticipantMessageMenuState } from './ParticipantMessageMenuContext'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS as DEFAULTS } from './participantLabels'
import { messageInfoRows } from './participantMessageInfoModel'
import { useOpenUpwards } from './useOpenUpwards'

type ParticipantMessageInfoProps = {
  readonly state: ParticipantMessageMenuState
  readonly message: ParticipantMessageActionsTarget
  readonly onClose: () => void
}

/** Small panel beside the bubble: author, when it was sent and, for this side's messages, delivery and reading. */
export function ParticipantMessageInfo({ state, message, onClose }: ParticipantMessageInfoProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const { labels } = state
  const title = labels.messageInfo ?? DEFAULTS.messageInfo ?? ''
  const rows = messageInfoRows(message, labels, state.locale)
  const isUpwards = useOpenUpwards(true, panelRef)

  useEffect(() => {
    closeRef.current?.focus()
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    function handlePointerDown(event: PointerEvent): void {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [onClose])

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title}
      className={`cv-p-failed-menu__list cv-p-message-menu__list cv-p-message-info${isUpwards ? ' cv-p-message-menu__list--up' : ''}`}
    >
      <div className="cv-p-message-info__head">
        <span className="cv-p-message-info__title">{title}</span>
        <button
          ref={closeRef}
          type="button"
          className="cv-p-message-info__close"
          aria-label={labels.closeMessageInfo ?? DEFAULTS.closeMessageInfo}
          onClick={onClose}
        >
          <X size={14} aria-hidden={true} />
        </button>
      </div>
      <dl className="cv-p-message-info__rows">
        {rows.map((row) => (
          <div key={row.id} className="cv-p-message-info__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
