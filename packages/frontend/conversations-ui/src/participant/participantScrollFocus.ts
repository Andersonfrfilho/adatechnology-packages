export type FocusableAncestorSource = {
  readonly closest: (selector: string) => { readonly focus: (options: { preventScroll: boolean }) => void } | null
}

export const SCROLLER_SELECTOR = '.cv-p-thread__scroll'

/** The button unmounts on click; moving focus first keeps it from falling to the body. */
export function focusScrollerOf(button: FocusableAncestorSource): void {
  button.closest(SCROLLER_SELECTOR)?.focus({ preventScroll: true })
}
