export type CopyKeyboardEvent = {
  readonly key: string
  preventDefault: () => void
}

export type CopyInteractionProps = {
  onClick?: () => void
  role?: 'button'
  tabIndex?: 0
  onKeyDown?: (event: CopyKeyboardEvent) => void
}

export type ResolveCopyInteractionOptions = {
  readonly copyOnClick: boolean
  readonly accessibleCopy: boolean
  readonly onCopy: () => void
}

export function resolveCopyInteraction({
  copyOnClick,
  accessibleCopy,
  onCopy,
}: ResolveCopyInteractionOptions): CopyInteractionProps {
  if (!copyOnClick) return {}
  if (!accessibleCopy) return { onClick: onCopy }

  return {
    onClick: onCopy,
    role: 'button',
    tabIndex: 0,
    onKeyDown: (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      onCopy()
    },
  }
}
