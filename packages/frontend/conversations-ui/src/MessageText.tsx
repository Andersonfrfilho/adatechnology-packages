import { useCallback, useState } from 'react'
import type { MessagePayload } from './types'
import { useConversations } from './providers/ConversationsProvider'
import { parseWhatsAppFormatting } from './lib/whatsapp-formatting'

export interface MessageTextProps {
  message: MessagePayload
}

export function MessageText({ message }: MessageTextProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!message.content) return
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard not available
    }
  }, [message.content])

  if (message.type === 'template')
    return <p className="text-sm italic text-[#667781]">{message.content ?? 'Template message'}</p>

  return (
    <div
      onClick={handleCopy}
      className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words select-all [&_strong]:font-bold [&_em]:italic [&_del]:line-through"
    >
      <span>
        {parseWhatsAppFormatting(message.content ?? '')}
      </span>
      {copied && (
        <span className="absolute top-0 right-0 -translate-y-full bg-[#3b4a54] text-white text-[11px] px-1.5 py-0.5 rounded shadow-lg">
          Copiado!
        </span>
      )}
    </div>
  )
}
