import { useCallback, useState } from 'react'
import { CHAT_TEXT_SECONDARY_CLASS } from './theme'
import type { MessagePayload } from './types'
import { parseWhatsAppFormatting } from './lib/whatsapp-formatting'
import { resolveCopyInteraction } from './messageTextCopyInteraction'
import { MessageTextCopiedBadge, type MessageTextAppearance } from './MessageTextCopiedBadge'

export interface MessageTextProps {
  message: MessagePayload
  /** Defaults to true (tap copies the text, as in 0.4.2); false disables copying. */
  copyOnClick?: boolean
  /** Opt-in: exposes the copy target as a keyboard-operable button (role, tabIndex, Enter/Space). Defaults to false. */
  accessibleCopy?: boolean
  /** Text of the badge shown after copying. Defaults to 'Copiado!', as in 0.4.2. */
  copiedLabel?: string
  /** 'tailwind' (default) keeps the 0.4.2 utility classes; 'stylesheet' uses the .cv-* rules from styles.css. */
  appearance?: MessageTextAppearance
}

const TAILWIND_CLASS =
  'text-[14.2px] leading-[19px] whitespace-pre-wrap break-words select-all [&_strong]:font-bold [&_em]:italic [&_del]:line-through'

function resolveClassName(appearance: MessageTextAppearance, copyOnClick: boolean): string {
  if (appearance === 'tailwind') return TAILWIND_CLASS
  return copyOnClick ? 'cv-message-text cv-message-text--copyable' : 'cv-message-text'
}

export function MessageText({
  message, copyOnClick = true, accessibleCopy = false, copiedLabel, appearance = 'tailwind',
}: MessageTextProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!copyOnClick || !message.content) return
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
    }
  }, [copyOnClick, message.content])

  if (message.type === 'template')
    return <p className={`text-sm italic ${CHAT_TEXT_SECONDARY_CLASS}`}>{message.content ?? 'Template message'}</p>

  const interactionProps = resolveCopyInteraction({ copyOnClick, accessibleCopy, onCopy: handleCopy })

  return (
    <div
      className={resolveClassName(appearance, copyOnClick)}
      {...interactionProps}
    >
      <div>{parseWhatsAppFormatting(message.content ?? '')}</div>
      {copied && <MessageTextCopiedBadge label={copiedLabel} appearance={appearance} />}
    </div>
  )
}
