export type AutoGrowTarget = {
  readonly style: { height: string }
  readonly scrollHeight: number
}

/** Fits the field to its content; the CSS max-height caps it and the field scrolls beyond that. */
export function fitTextareaHeight(target: AutoGrowTarget): void {
  target.style.height = 'auto'
  target.style.height = `${target.scrollHeight}px`
}
