/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  isValidBrazilianDocument,
  maskBrazilianDocumentInput,
  normalizeBrazilianDocument,
} from '@adatechnology/document-intake'
import type { InputHTMLAttributes } from 'react'

const COMPLETE_DOCUMENT_LENGTHS: readonly number[] = [11, 14]

export type BrazilianDocumentInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode'
> & {
  /** Valor guardado (com ou sem máscara). */
  readonly value: string
  /** Recebe o valor para gravar: sem máscara, letras em maiúscula (o CNPJ alfanumérico mantém as letras). */
  readonly onValueChange: (normalizedValue: string) => void
}

/**
 * Um campo só para CPF ou CNPJ: a máscara muda de `000.000.000-00` para `00.000.000/0000-00` ao digitar o 12º
 * caractere (ou uma letra, no CNPJ alfanumérico). Documento completo cujo dígito verificador não fecha marca
 * `aria-invalid`; o estilo do estado inválido é do host (`aria-[invalid=true]:...`).
 */
export function BrazilianDocumentInput({ value, onValueChange, ...inputProps }: BrazilianDocumentInputProps) {
  const displayed = maskBrazilianDocumentInput(value)
  const normalized = normalizeBrazilianDocument(displayed)
  const isInvalid = COMPLETE_DOCUMENT_LENGTHS.includes(normalized.length) && !isValidBrazilianDocument(normalized)

  function handleChange(typed: string) {
    onValueChange(normalizeBrazilianDocument(maskBrazilianDocumentInput(typed)))
  }

  return (
    <input
      autoComplete="off"
      autoCapitalize="characters"
      spellCheck={false}
      {...inputProps}
      type="text"
      inputMode="text"
      maxLength={18}
      value={displayed}
      aria-invalid={isInvalid || undefined}
      onChange={(event) => handleChange(event.target.value)}
    />
  )
}
