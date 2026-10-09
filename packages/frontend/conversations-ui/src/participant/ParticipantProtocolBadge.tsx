import { useEffect, useState } from 'react'

import type { ParticipantConversationsLabels } from './participantLabels'
import { copyProtocolToClipboard } from './participantProtocolCopy'

const COPIED_ANNOUNCEMENT_MS = 3000

export type ParticipantProtocolBadgeProps = {
  readonly protocol: string
  readonly labels: ParticipantConversationsLabels
}

export function ParticipantProtocolBadge({ protocol, labels }: ParticipantProtocolBadgeProps) {
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    if (!isCopied) return undefined
    const timer = setTimeout(() => setIsCopied(false), COPIED_ANNOUNCEMENT_MS)
    return () => clearTimeout(timer)
  }, [isCopied])

  async function handleCopy(): Promise<void> {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
    setIsCopied(await copyProtocolToClipboard(protocol, clipboard))
  }

  return (
    <>
      <div className="cv-p-protocol cv-p-protocol--header">
        <span className="cv-p-protocol__code" aria-label={`${labels.protocolPrefix} ${protocol}`}>
          {protocol}
        </span>
        <button type="button" className="cv-p-protocol__copy" onClick={() => void handleCopy()}>
          {labels.copyProtocol}
        </button>
      </div>
      <div className="cv-p-sr-only" role="status" aria-live="polite">
        {isCopied ? labels.protocolCopied : ''}
      </div>
    </>
  )
}
