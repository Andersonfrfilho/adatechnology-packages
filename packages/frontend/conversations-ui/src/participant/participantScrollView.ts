const BADGE_CAP = 99

export type ScrollToLatestViewParams = {
  /** Already decided by shouldStickToBottom; this rule never looks at pixels. */
  readonly isAwayFromBottom: boolean
  readonly newMessagesCount: number
  readonly hasMessages: boolean
}

export type ScrollToLatestView = {
  readonly isVisible: boolean
  readonly badge: string | undefined
}

export type ScrollToLatestOptionsParams = {
  readonly scrollHeight: number
  readonly isReducedMotion: boolean
}

export function resolveScrollToLatestView(params: ScrollToLatestViewParams): ScrollToLatestView {
  const { isAwayFromBottom, newMessagesCount, hasMessages } = params
  if (!isAwayFromBottom || !hasMessages) return { isVisible: false, badge: undefined }
  if (newMessagesCount <= 0) return { isVisible: true, badge: undefined }
  return { isVisible: true, badge: newMessagesCount > BADGE_CAP ? `${BADGE_CAP}+` : String(newMessagesCount) }
}

export function scrollToLatestOptions(params: ScrollToLatestOptionsParams): ScrollToOptions {
  return { top: params.scrollHeight, behavior: params.isReducedMotion ? 'auto' : 'smooth' }
}

export function scrollIntoViewOptions(isReducedMotion: boolean): ScrollIntoViewOptions {
  return { block: 'nearest', inline: 'nearest', behavior: isReducedMotion ? 'auto' : 'smooth' }
}

export function readPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
