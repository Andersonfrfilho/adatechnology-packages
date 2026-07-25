const statusColors = {
  read: '#53bdeb',
  delivered: '#8696a0',
  sent: '#8696a0',
}

export interface StatusTicksProps {
  status: string
}

export function StatusTicks({ status }: StatusTicksProps) {
  if (status === 'failed')
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-red-500 block">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )

  if (status === 'read')
    return (
      <svg width="17" height="13" viewBox="0 0 17 13" fill="none" className="block">
        <path d="M1 6L4.5 9.5L9 5" stroke={statusColors.read} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 6L10.5 9.5L16 4" stroke={statusColors.read} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )

  if (status === 'delivered')
    return (
      <svg width="17" height="13" viewBox="0 0 17 13" fill="none" className="block">
        <path d="M1 6L4.5 9.5L9 5" stroke={statusColors.delivered} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 6L10.5 9.5L16 4" stroke={statusColors.delivered} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )

  return (
    <svg width="12" height="13" viewBox="0 0 12 13" fill="none" className="block mt-px">
      <path d="M1.5 6.5L4.5 9.5L10.5 3" stroke={statusColors.sent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
