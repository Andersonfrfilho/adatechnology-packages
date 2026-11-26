/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useId, type ReactElement, type ReactNode } from 'react'

export type TooltipProps = {
  readonly text: string
  readonly children: ReactElement
}

/**
 * Dica por hover E foco de teclado, ligada ao controle por `aria-describedby`. Nunca o `title` nativo:
 * ele não aparece no foco, não é estilizável e some em toque. CSS puro, sem posicionamento em JS.
 */
export function Tooltip({ text, children }: TooltipProps): ReactNode {
  const tipId = useId()
  return (
    <span className="adc-tooltip">
      <span aria-describedby={tipId} className="adc-tooltip__anchor">
        {children}
      </span>
      <span role="tooltip" id={tipId} className="adc-tooltip__bubble">
        {text}
      </span>
    </span>
  )
}
