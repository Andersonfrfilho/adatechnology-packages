export interface MessageTailProps {
  isOutbound: boolean
}

export function MessageTail({ isOutbound }: MessageTailProps) {
  if (isOutbound)
    return (
      <svg className="absolute top-0 -right-[5px] w-[5px] h-[11px]" viewBox="0 0 5 11" fill="#d9fdd3">
        <path d="M5 0H0v11c1.5-2 4.5-2 5-4V0z" />
      </svg>
    )

  return (
    <svg className="absolute top-0 -left-[5px] w-[5px] h-[11px]" viewBox="0 0 5 11" fill="white">
      <path d="M0 0h5v11C3.5 9 .5 9 0 7V0z" />
    </svg>
  )
}
