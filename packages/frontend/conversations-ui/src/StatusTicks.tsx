import { AlertTriangle } from 'lucide-react'

export interface StatusTicksProps {
  status: string
  title?: string
}

const STATUS_COLOR_CLASS: Record<string, string> = {
  sent: 'text-black/40 dark:text-white/40',
  delivered: 'text-black/40 dark:text-white/40',
  read: 'text-sky-500',
  failed: 'text-red-500',
}

function Ticks({ double }: { double: boolean }) {
  return (
    <svg viewBox="0 0 20 12" width="15" height="9" fill="none" xmlns="http://www.w3.org/2000/svg">
      {double && (
        <path d="M1 6.5L4.5 10L11 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
      <path
        d={double ? 'M6 6.5L9.5 10L19 1' : 'M1 6.5L5 10.5L14.5 1'}
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

// Paridade com financiamento-imobiliario-bot/apps/web/src/components/MessageBubble.tsx —
// mesmo path de SVG, mesma cor por status (read → sky-500, failed → red-500 com AlertTriangle).
export function StatusTicks({ status, title }: StatusTicksProps) {
  const colorClass = STATUS_COLOR_CLASS[status] ?? STATUS_COLOR_CLASS.sent

  return (
    <span className={`cursor-help leading-none flex items-center ${colorClass}`} data-cv-tooltip={title}>
      {status === 'failed' ? <AlertTriangle size={11} /> : <Ticks double={status !== 'sent'} />}
    </span>
  )
}
