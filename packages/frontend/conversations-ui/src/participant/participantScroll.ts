export const NEAR_BOTTOM_THRESHOLD_PX = 80

export type ShouldStickToBottomParams = {
  readonly scrollTop: number
  readonly clientHeight: number
  readonly scrollHeight: number
  readonly threshold: number
}

export type ScrollAnchorAfterPrependParams = {
  readonly previousScrollTop: number
  readonly previousScrollHeight: number
  readonly scrollHeight: number
}

export type ResolveScrollActionParams = {
  readonly hasPositioned: boolean
  readonly previousFirstKey: string | undefined
  readonly previousLastKey: string | undefined
  readonly firstKey: string | undefined
  readonly lastKey: string | undefined
  readonly wasNearBottom: boolean
}

export type ScrollAction = 'none' | 'bottom' | 'anchor'

export function shouldStickToBottom(params: ShouldStickToBottomParams): boolean {
  const { scrollTop, clientHeight, scrollHeight, threshold } = params
  return scrollHeight - scrollTop - clientHeight <= threshold
}

export function scrollAnchorAfterPrepend(params: ScrollAnchorAfterPrependParams): number {
  return params.previousScrollTop + (params.scrollHeight - params.previousScrollHeight)
}

export function resolveScrollAction(params: ResolveScrollActionParams): ScrollAction {
  const { firstKey, lastKey } = params
  if (firstKey === undefined || lastKey === undefined) return 'none'
  if (!params.hasPositioned) return 'bottom'
  if (lastKey !== params.previousLastKey && params.wasNearBottom) return 'bottom'
  if (firstKey !== params.previousFirstKey) return 'anchor'
  return 'none'
}
