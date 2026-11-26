/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Dica do pacote (nunca o `title` nativo): aparece no hover e no foco do teclado, some com Esc e
 * herda cores dos tokens `--adc-*`. O texto repete o `aria-label` do botão que ela acompanha.
 */

import { useId, useState, type ReactElement } from 'react'

export type TooltipProps = {
  readonly text: string
  readonly children: ReactElement
}

export function Tooltip({ text, children }: TooltipProps) {
  const id = useId()
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  return (
    <span
      className="adc-tip"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !(isHovered || isFocused)) return
        setIsHovered(false)
        setIsFocused(false)
      }}
    >
      <span aria-describedby={id} className="adc-tip-target">
        {children}
      </span>
      <span id={id} role="tooltip" className="adc-tooltip" data-visible={isHovered || isFocused}>
        {text}
      </span>
    </span>
  )
}
