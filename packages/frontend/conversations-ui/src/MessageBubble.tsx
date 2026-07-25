import type { MessagePayload } from './types'

export interface MessageBubbleProps {
  message: MessagePayload
}

export const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isOutbound = message.direction === 'outbound'
  const isFirst = message.isFirstInGroup !== false
  const isLast = message.isLastInGroup !== false

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} px-3 md:px-16 ${isFirst ? 'mt-3' : 'mt-0'} ${isLast ? 'mb-1' : 'mb-0'}`}>
      <div
        className={`relative max-w-[85%] md:max-w-[65%] px-[9px] py-[6px] rounded-lg ${
          isOutbound ? 'bg-[#d9fdd3]' : 'bg-white'
        } text-[#111b21]`}
        style={{
          boxShadow: '0 1px 0.5px rgba(11,20,26,0.13)',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {message.type === 'text' && (
          <div className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words">
            {message.content}
          </div>
        )}

        <div className="flex items-center justify-end gap-[3px] mt-1">
          <span className="text-[11px] text-[#667781] leading-[15px]">
            {formatTime(message.timestamp)}
          </span>
          {isOutbound && message.status && (
            <Ticks status={message.status} />
          )}
        </div>
      </div>
    </div>
  )
}

function Ticks({ status }: { status: string }) {
  if (status === 'read')
    return (
      <svg width="17" height="13" viewBox="0 0 17 13" fill="none" className="block">
        <path d="M1 6L4.5 9.5L9 5" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 6L10.5 9.5L16 4" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )

  if (status === 'delivered')
    return (
      <svg width="17" height="13" viewBox="0 0 17 13" fill="none" className="block">
        <path d="M1 6L4.5 9.5L9 5" stroke="#8696a0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 6L10.5 9.5L16 4" stroke="#8696a0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )

  return (
    <svg width="12" height="13" viewBox="0 0 12 13" fill="none" className="block mt-px">
      <path d="M1.5 6.5L4.5 9.5L10.5 3" stroke="#8696a0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return ts
  }
}
