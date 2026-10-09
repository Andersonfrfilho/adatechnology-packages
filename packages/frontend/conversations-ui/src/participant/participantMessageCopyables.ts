import { isValidCnpj, isValidCpf } from './participantDocuments'
import type { CopyableKind, InlineAtom } from './participantMessageFormat.types'

type Scanner = { readonly copyKind: CopyableKind; readonly pattern: RegExp; readonly isValid: (raw: string) => boolean }

const DOCUMENT_SEPARATORS = /[.\-/\s]/g
const ACCESS_KEY_PATTERN = /\d{44}|\d{4}(?: \d{4}){10}/gu
const CNPJ_PATTERN = /[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\/[A-Z0-9]{4}-\d{2}|[A-Z0-9]{12}\d{2}/gu
const CPF_PATTERN = /\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11}/gu
const BRAZIL_PHONE_PATTERN = /(?:\+?55[\s.-]?)?(?:\([1-9][1-9]\)|[1-9][1-9])[\s.-]?(?:9\d{4}|[2-5]\d{3})[\s.-]?\d{4}/gu
const INTERNATIONAL_PHONE_PATTERN = /\+\d{1,3}(?:[\s.-]?\d{2,5}){2,4}/gu
const EMAIL_LOCAL = /^[\p{L}\p{N}._%+-]+$/u
const EMAIL_DOMAIN = /^[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}$/u

function bare(raw: string): string {
  return raw.replace(DOCUMENT_SEPARATORS, '')
}

function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{N}]/u.test(character)
}

function hasPhoneDigitCount(raw: string): boolean {
  const count = raw.replace(/\D/g, '').length
  return count >= 10 && count <= 15
}

/** Bare 10/11 digits are order numbers as often as phones: demand +country, a bracketed DDD or a separator after it. */
function isFormattedBrazilPhone(raw: string): boolean {
  return /^\+|\(|^\d{2}[\s.-]/u.test(raw) && hasPhoneDigitCount(raw)
}

const SCANNERS: readonly Scanner[] = [
  { copyKind: 'accessKey', pattern: ACCESS_KEY_PATTERN, isValid: (raw) => !/^(\d)\1+$/.test(bare(raw)) },
  { copyKind: 'cnpj', pattern: CNPJ_PATTERN, isValid: (raw) => isValidCnpj(bare(raw)) },
  { copyKind: 'cpf', pattern: CPF_PATTERN, isValid: (raw) => isValidCpf(bare(raw)) },
  { copyKind: 'phone', pattern: BRAZIL_PHONE_PATTERN, isValid: isFormattedBrazilPhone },
  {
    copyKind: 'phone',
    pattern: INTERNATIONAL_PHONE_PATTERN,
    isValid: (raw) => hasPhoneDigitCount(raw) && !raw.startsWith('+55'),
  },
]

function scan(text: string, scanner: Scanner): InlineAtom[] {
  const atoms: InlineAtom[] = []
  for (const match of text.matchAll(scanner.pattern)) {
    const [value] = match
    const start = match.index
    const end = start + value.length
    if (isWordCharacter(text[start - 1]) || isWordCharacter(text[end])) continue
    if (!scanner.isValid(value)) continue
    atoms.push({ start, end, node: { kind: 'copyable', copyKind: scanner.copyKind, value } })
  }
  return atoms
}

function findEmailAtoms(text: string): InlineAtom[] {
  const atoms: InlineAtom[] = []
  for (let at = text.indexOf('@'); at !== -1; at = text.indexOf('@', at + 1)) {
    let start = at
    while (start > 0 && /[\p{L}\p{N}._%+-]/u.test(text[start - 1] ?? '')) start -= 1
    let end = at + 1
    while (end < text.length && /[\p{L}\p{N}.-]/u.test(text[end] ?? '')) end += 1
    while (end > at + 1 && /[.-]/.test(text[end - 1] ?? '')) end -= 1
    const isValid = EMAIL_LOCAL.test(text.slice(start, at)) && EMAIL_DOMAIN.test(text.slice(at + 1, end))
    if (isValid) {
      atoms.push({ start, end, node: { kind: 'copyable', copyKind: 'email', value: text.slice(start, end) } })
    }
  }
  return atoms
}

export function findCopyableAtoms(text: string): InlineAtom[] {
  return [...SCANNERS.flatMap((scanner) => scan(text, scanner)), ...findEmailAtoms(text)]
}
