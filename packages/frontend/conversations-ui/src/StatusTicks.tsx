import { AlertTriangle, Clock } from 'lucide-react'

export interface StatusTicksProps {
  status: string
  title?: string
  /** 'tailwind' (default) keeps the 0.4.2 markup; 'stylesheet' uses .cv-status-ticks--* and adds queued/bounced handling. */
  appearance?: 'tailwind' | 'stylesheet'
  /** Accessible label of the queued state (stylesheet appearance only). Defaults to 'Queued'. */
  queuedLabel?: string
}

const TAILWIND_COLOR_CLASS: Record<string, string> = {
  sent: 'text-black/40 dark:text-white/40',
  delivered: 'text-black/40 dark:text-white/40',
  read: 'text-sky-500',
  failed: 'text-red-500',
}

const STYLESHEET_MODIFIER: Record<string, string> = {
  queued: 'queued',
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
  bounced: 'failed',
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

function StylesheetStatusTicks({ status, title, queuedLabel }: { status: string; title?: string; queuedLabel: string }) {
  const modifier = STYLESHEET_MODIFIER[status] ?? 'sent'
  const ariaLabel = modifier === 'queued' ? queuedLabel : undefined
  const icon =
    modifier === 'failed' ? <AlertTriangle size={11} /> : modifier === 'queued' ? <Clock size={11} /> : <Ticks double={modifier !== 'sent'} />

  return (
    <span
      className={`cv-status-ticks cv-status-ticks--${modifier}`}
      data-cv-tooltip={title ?? ariaLabel}
      aria-label={ariaLabel}
    >
      {icon}
    </span>
  )
}

export function StatusTicks({ status, title, appearance = 'tailwind', queuedLabel = 'Queued' }: StatusTicksProps) {
  if (appearance === 'stylesheet') return <StylesheetStatusTicks status={status} title={title} queuedLabel={queuedLabel} />

  const colorClass = TAILWIND_COLOR_CLASS[status] ?? TAILWIND_COLOR_CLASS.sent

  return (
    <span className={`cursor-help leading-none flex items-center ${colorClass}`} data-cv-tooltip={title}>
      {status === 'failed' ? <AlertTriangle size={11} /> : <Ticks double={status !== 'sent'} />}
    </span>
  )
}
