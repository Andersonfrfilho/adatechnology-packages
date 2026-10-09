export type AutoGrowTarget = {
  readonly style: { height: string }
  readonly scrollHeight: number
  readonly offsetHeight: number
  readonly clientHeight: number
}

/** Fits the field to its content plus its border (border-box), so no phantom scrollbar; the CSS max-height caps it. */
export function fitTextareaHeight(target: AutoGrowTarget): void {
  target.style.height = 'auto'
  target.style.height = `${target.scrollHeight + (target.offsetHeight - target.clientHeight)}px`
}
