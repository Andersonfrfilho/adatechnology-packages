import { StatusTicks } from './StatusTicks'
import { CHAT_TEXT_SECONDARY_CLASS } from './theme'

export interface MessageTimestampProps {
  timestamp: string
  status?: string
  isOutbound: boolean
}

export function MessageTimestamp({ timestamp, status, isOutbound }: MessageTimestampProps) {
  return (
    <div className="flex items-center justify-end gap-[3px]">
      <span className={`text-[11px] ${CHAT_TEXT_SECONDARY_CLASS} leading-[15px] select-none`}>
        {timestamp}
      </span>
      {isOutbound && status && (
        <span className="flex items-center -mr-[2px]">
          <StatusTicks status={status} />
        </span>
      )}
    </div>
  )
}
