/* Copyright (c) 2026 Ada Technology. MIT License. */

import { isValidCnpj, isValidCpf } from './checkDigit.service'

/**
 * CPF (11 dígitos) e CNPJ (14 posições; a base aceita letra desde o CNPJ alfanumérico, IN RFB 2229/2024).
 *
 * **Nunca** normalizar por `replace(/\D/g, '')`: num CNPJ alfanumérico a letra some em silêncio e o documento passa a
 * apontar para outro contribuinte. Só a máscara (`.`, `-`, `/`, espaço) é removida.
 */
export const BRAZILIAN_DOCUMENT_KIND = { CPF: 'cpf', CNPJ: 'cnpj' } as const
export type BrazilianDocumentKind = (typeof BRAZILIAN_DOCUMENT_KIND)[keyof typeof BRAZILIAN_DOCUMENT_KIND]

const CPF_LENGTH = 11
const CNPJ_LENGTH = 14
const CNPJ_BASE_LENGTH = 12
const MASK_CHARACTERS = /[.\-/\s]/gu
const NOT_ALPHANUMERIC = /[^0-9A-Z]/gu
const DIGITS_ONLY = /^[0-9]+$/u
const LETTER = /[A-Z]/u
const MASK_PLACEHOLDER = '•'
const DEFAULT_VISIBLE_CHARACTERS = 4

const CPF_GROUPS = [3, 3, 3, 2] as const
const CPF_SEPARATORS = ['.', '.', '-'] as const
const CNPJ_GROUPS = [2, 3, 3, 4, 2] as const
const CNPJ_SEPARATORS = ['.', '.', '/', '-'] as const

/** Tira a máscara e sobe a caixa; não remove caractere desconhecido (o validador o recusa). */
export function normalizeBrazilianDocument(value: string): string {
  return value.replace(MASK_CHARACTERS, '').toUpperCase()
}

/** `cpf` para 11 dígitos, `cnpj` para 14 posições (letras só na base de 12). Qualquer outra coisa: `undefined`. */
export function detectBrazilianDocumentKind(value: string): BrazilianDocumentKind | undefined {
  const normalized = normalizeBrazilianDocument(value)
  if (normalized.length === CPF_LENGTH && DIGITS_ONLY.test(normalized)) return BRAZILIAN_DOCUMENT_KIND.CPF
  if (normalized.length === CNPJ_LENGTH && /^[0-9A-Z]{12}[0-9]{2}$/u.test(normalized))
    return BRAZILIAN_DOCUMENT_KIND.CNPJ
  return undefined
}

/** Tamanho certo **e** dígitos verificadores que fecham. `111.111.111-11` e afins são recusados. */
export function isValidBrazilianDocument(value: string): boolean {
  const kind = detectBrazilianDocumentKind(value)
  if (kind === BRAZILIAN_DOCUMENT_KIND.CPF) return isValidCpf(value)
  if (kind === BRAZILIAN_DOCUMENT_KIND.CNPJ) return isValidCnpj(value)
  return false
}

function applyGroups(params: {
  readonly characters: string
  readonly groups: readonly number[]
  readonly separators: readonly string[]
}): string {
  const { characters, groups, separators } = params
  let position = 0
  let result = ''
  for (const [index, size] of groups.entries()) {
    if (position >= characters.length) break
    if (index > 0) result += separators[index - 1] ?? ''
    result += characters.slice(position, position + size)
    position += size
  }
  return result
}

/** `000.000.000-00` ou `00.000.000/0000-00`. Valor que não é CPF nem CNPJ completo sai como veio. */
export function formatBrazilianDocument(value: string): string {
  const kind = detectBrazilianDocumentKind(value)
  const characters = normalizeBrazilianDocument(value)
  if (kind === BRAZILIAN_DOCUMENT_KIND.CPF)
    return applyGroups({ characters, groups: CPF_GROUPS, separators: CPF_SEPARATORS })
  if (kind === BRAZILIAN_DOCUMENT_KIND.CNPJ)
    return applyGroups({ characters, groups: CNPJ_GROUPS, separators: CNPJ_SEPARATORS })
  return value
}

/** Posição 13 e 14 do CNPJ são sempre dígitos; letra digitada ali é descartada. */
function keepAllowedCharacters(typed: string): string {
  let kept = ''
  for (const character of typed.replace(MASK_CHARACTERS, '').toUpperCase().replace(NOT_ALPHANUMERIC, '')) {
    if (kept.length >= CNPJ_LENGTH) break
    const isDigit = DIGITS_ONLY.test(character)
    if (kept.length >= CNPJ_BASE_LENGTH && !isDigit) continue
    kept += character
  }
  return kept
}

/**
 * Máscara progressiva para um único campo que aceita CPF **ou** CNPJ. Até 11 dígitos aparece como CPF
 * (`529.982.247-25`); ao digitar o 12º caractere, ou qualquer letra, vira CNPJ (`11.222.333/0001-81`).
 * Use no `onChange`: devolve o texto a mostrar; `normalizeBrazilianDocument` dá o valor a gravar.
 */
export function maskBrazilianDocumentInput(typed: string): string {
  const characters = keepAllowedCharacters(typed)
  const isCnpj = characters.length > CPF_LENGTH || LETTER.test(characters)
  return isCnpj
    ? applyGroups({ characters, groups: CNPJ_GROUPS, separators: CNPJ_SEPARATORS })
    : applyGroups({ characters, groups: CPF_GROUPS, separators: CPF_SEPARATORS })
}

/**
 * Exibição mascarada que mantém só os últimos caracteres: `•••.•••.•47-25` (padrão 4). Mantém a pontuação do
 * documento; valor que não é CPF nem CNPJ mascara tudo menos o fim, sem inventar pontuação.
 */
export function maskBrazilianDocumentForDisplay(
  value: string,
  options: { readonly visibleCharacters?: number } = {},
): string {
  const visible = Math.max(0, options.visibleCharacters ?? DEFAULT_VISIBLE_CHARACTERS)
  const formatted = formatBrazilianDocument(value)
  const total = [...formatted].filter((character) => !isSeparator(character)).length
  let seen = 0
  return [...formatted]
    .map((character) => {
      if (isSeparator(character)) return character
      seen += 1
      return seen > total - visible ? character : MASK_PLACEHOLDER
    })
    .join('')
}

function isSeparator(character: string): boolean {
  return character === '.' || character === '-' || character === '/' || /\s/u.test(character)
}
