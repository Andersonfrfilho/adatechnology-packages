import { Check, Copy } from 'lucide-react'

import { useParticipantCopyFeedback } from './useParticipantCopyFeedback'
import type { CopyableKind } from './participantMessageFormat.types'
import type { ParticipantConversationsLabels } from './participantLabels'

type CopyLabels = Pick<ParticipantConversationsLabels, 'copyValue' | 'valueCopied'>

export type ParticipantCopyableTokenProps = {
  readonly copyKind: CopyableKind
  readonly value: string
  readonly labels: CopyLabels
}

export function ParticipantCopyableToken({ copyKind, value, labels }: ParticipantCopyableTokenProps) {
  const { isCopied, copy } = useParticipantCopyFeedback()
  return (
    <button
      type="button"
      className={`cv-p-copyable cv-p-copyable--${copyKind}`}
      aria-label={`${labels.copyValue} ${value}`}
      onClick={() => copy(value, labels.valueCopied)}
    >
      {value}
      {isCopied ? (
        <span className="cv-p-copyable__done" aria-hidden="true">
          <Check size={12} aria-hidden={true} /> {labels.valueCopied}
        </span>
      ) : null}
    </button>
  )
}

export type ParticipantLinkCopyButtonProps = {
  readonly value: string
  readonly labels: CopyLabels
}

export function ParticipantLinkCopyButton({ value, labels }: ParticipantLinkCopyButtonProps) {
  const { isCopied, copy } = useParticipantCopyFeedback()
  return (
    <button
      type="button"
      className="cv-p-text__link-copy"
      aria-label={`${labels.copyValue} ${value}`}
      onClick={() => copy(value, labels.valueCopied)}
    >
      {isCopied ? <Check size={14} aria-hidden={true} /> : <Copy size={14} aria-hidden={true} />}
    </button>
  )
}
