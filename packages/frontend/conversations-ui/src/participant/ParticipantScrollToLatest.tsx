import { ChevronDown } from 'lucide-react'

import { focusScrollerOf } from './participantScrollFocus'
import { resolveScrollToLatestView } from './participantScrollView'

export type ParticipantScrollToLatestProps = {
  readonly label: string
  readonly isAwayFromBottom: boolean
  readonly hasMessages: boolean
  readonly newMessagesCount: number
  /** Absent (a host that does not own the scroller) draws nothing. */
  readonly onClick: (() => void) | undefined
}

export function ParticipantScrollToLatest({
  label,
  isAwayFromBottom,
  hasMessages,
  newMessagesCount,
  onClick,
}: ParticipantScrollToLatestProps) {
  const { isVisible, badge } = resolveScrollToLatestView({ isAwayFromBottom, newMessagesCount, hasMessages })
  if (!isVisible || onClick === undefined) return null
  return (
    <div className="cv-p-thread__latest">
      <button type="button" className="cv-p-thread__latest-button" aria-label={label} data-cv-tooltip={label} onClick={(event) => {
          focusScrollerOf(event.currentTarget)
          onClick()
        }}
      >
        <ChevronDown size={24} aria-hidden="true" focusable="false" />
        {badge ? (
          <span className="cv-p-thread__latest-badge" aria-hidden="true">
            {badge}
          </span>
        ) : null}
      </button>
    </div>
  )
}
