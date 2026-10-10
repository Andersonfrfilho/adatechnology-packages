import { Check, Copy } from 'lucide-react'
import { useEffect, useReducer } from 'react'

import type { ParticipantConversationsLabels } from './participantLabels'
import {
  INITIAL_PROTOCOL_COPY_STATE,
  copyProtocolToClipboard,
  protocolCopyReducer,
  type ProtocolCopyState,
} from './participantProtocolCopy'

const COPIED_ANNOUNCEMENT_MS = 3000

export type ParticipantProtocolBadgeProps = {
  readonly protocol: string
  readonly labels: ParticipantConversationsLabels
}

export type ParticipantProtocolBadgeViewProps = ParticipantProtocolBadgeProps & {
  readonly copyState: ProtocolCopyState
  readonly onCopy: () => void
}

export function ParticipantProtocolBadgeView({
  protocol,
  labels,
  copyState,
  onCopy,
}: ParticipantProtocolBadgeViewProps) {
  const { isCopied, copyCount } = copyState
  return (
    <>
      <span className="cv-p-protocol cv-p-protocol--header">
        <span className="cv-p-protocol__code">
          <span className="cv-p-sr-only">{labels.protocolPrefix} </span>
          {protocol}
        </span>
        <button
          type="button"
          className="cv-p-protocol__copy"
          aria-label={`${labels.copyProtocol} ${protocol}`}
          data-cv-tooltip={labels.copyProtocol}
          onClick={onCopy}
        >
          {isCopied ? <Check size={18} aria-hidden={true} /> : <Copy size={18} aria-hidden={true} />}
          {isCopied ? (
            <span className="cv-p-protocol__copied" aria-hidden="true">
              {labels.protocolCopied}
            </span>
          ) : null}
        </button>
      </span>
      <div className="cv-p-sr-only" role="status" aria-live="polite">
        {isCopied ? <span key={copyCount}>{labels.protocolCopied}</span> : null}
      </div>
    </>
  )
}

export function ParticipantProtocolBadge({ protocol, labels }: ParticipantProtocolBadgeProps) {
  const [copyState, dispatch] = useReducer(protocolCopyReducer, INITIAL_PROTOCOL_COPY_STATE)
  const { isCopied, copyCount } = copyState

  useEffect(() => {
    if (!isCopied) return undefined
    const timer = setTimeout(() => dispatch({ type: 'expired' }), COPIED_ANNOUNCEMENT_MS)
    return () => clearTimeout(timer)
  }, [isCopied, copyCount])

  async function handleCopy(): Promise<void> {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
    if (await copyProtocolToClipboard(protocol, clipboard)) dispatch({ type: 'copied' })
  }

  return (
    <ParticipantProtocolBadgeView
      protocol={protocol}
      labels={labels}
      copyState={copyState}
      onCopy={() => void handleCopy()}
    />
  )
}
