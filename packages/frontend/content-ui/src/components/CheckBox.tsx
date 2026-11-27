/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Check, Minus } from 'lucide-react'
import type { ReactNode } from 'react'

export type CheckBoxProps = {
  readonly checked: boolean
  /** Seleção parcial (cabeçalho da tabela com algumas linhas marcadas). */
  readonly isMixed?: boolean
  readonly label: string
  readonly onChange: () => void
}

/** Caixa de marcar do pacote (botão com `role="checkbox"`): o visual não depende do controle nativo do navegador. */
export function CheckBox({ checked, isMixed = false, label, onChange }: CheckBoxProps): ReactNode {
  const Icon = isMixed ? Minus : Check
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isMixed ? 'mixed' : checked}
      aria-label={label}
      className={`adc-checkbox${checked || isMixed ? ' is-on' : ''}`}
      onClick={onChange}
    >
      {(checked || isMixed) && <Icon aria-hidden="true" className="adc-icon" />}
    </button>
  )
}
