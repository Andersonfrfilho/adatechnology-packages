import { AlertTriangle, Clock } from 'lucide-react'

export interface StatusTicksProps {
  status: string
  title?: string
}

const STATUS_MODIFIER: Record<string, string> = {
  queued: 'queued',
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
  bounced: 'failed',
}

const QUEUED_LABEL = 'Queued'

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
function StatusIcon({ modifier }: { modifier: string }) {
  if (modifier === 'failed') return <AlertTriangle size={11} />
  if (modifier === 'queued') return <Clock size={11} />
  return <Ticks double={modifier !== 'sent'} />
}

export function StatusTicks({ status, title }: StatusTicksProps) {
  const modifier = STATUS_MODIFIER[status] ?? 'sent'
  const ariaLabel = modifier === 'queued' ? QUEUED_LABEL : undefined

  return (
    <span
      className={`cv-status-ticks cv-status-ticks--${modifier}`}
      data-cv-tooltip={title ?? ariaLabel}
      aria-label={ariaLabel}
    >
      <StatusIcon modifier={modifier} />
    </span>
  )
}
