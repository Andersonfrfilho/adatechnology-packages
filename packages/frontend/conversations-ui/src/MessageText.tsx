import { useCallback, useState, type KeyboardEvent } from 'react'
import { CHAT_TEXT_SECONDARY_CLASS } from './theme'
import type { MessagePayload } from './types'
import { parseWhatsAppFormatting } from './lib/whatsapp-formatting'
import { MessageTextCopiedBadge } from './MessageTextCopiedBadge'

export interface MessageTextProps {
  message: MessagePayload
  /** Defaults to true (tap copies the text, as in 0.3.1); false disables copying and its button semantics. */
  copyOnClick?: boolean
  /** Text of the badge shown after copying; absent means the package default ("Copied"). */
  copiedLabel?: string
}

export function MessageText({ message, copyOnClick = true, copiedLabel }: MessageTextProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!copyOnClick || !message.content) return
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard not available
    }
  }, [copyOnClick, message.content])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    void handleCopy()
  }

  if (message.type === 'template')
    return <p className={`text-sm italic ${CHAT_TEXT_SECONDARY_CLASS}`}>{message.content ?? 'Template message'}</p>

  return (
    <div
      className={copyOnClick ? 'cv-message-text cv-message-text--copyable' : 'cv-message-text'}
      {...(copyOnClick
        ? { role: 'button', tabIndex: 0, onClick: handleCopy, onKeyDown: handleKeyDown }
        : {})}
    >
      <div>{parseWhatsAppFormatting(message.content ?? '')}</div>
      {copied && <MessageTextCopiedBadge label={copiedLabel} />}
    </div>
  )
}
