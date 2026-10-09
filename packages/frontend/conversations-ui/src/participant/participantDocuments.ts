const CNPJ_FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const
const CNPJ_SECOND_WEIGHTS = [6, ...CNPJ_FIRST_WEIGHTS] as const

function charValue(character: string): number {
  return character.charCodeAt(0) - 48
}

function isRepeatedSequence(value: string): boolean {
  return new Set(value).size === 1
}

function weightedSum(characters: string, weights: readonly number[]): number {
  let sum = 0
  for (let index = 0; index < weights.length; index += 1) {
    sum += charValue(characters.charAt(index)) * (weights[index] ?? 0)
  }
  return sum
}

function cnpjCheckDigit(characters: string, weights: readonly number[]): number {
  const remainder = weightedSum(characters, weights) % 11
  return remainder < 2 ? 0 : 11 - remainder
}

function cpfCheckDigit(digits: string, length: number): number {
  const weights = Array.from({ length }, (_, index) => length + 1 - index)
  return ((weightedSum(digits, weights) * 10) % 11) % 10
}

/** `digits` is the bare 11-digit CPF; repeated sequences such as 111.111.111-11 are rejected. */
export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || isRepeatedSequence(digits)) return false
  return (
    cpfCheckDigit(digits, 9) === charValue(digits.charAt(9)) &&
    cpfCheckDigit(digits, 10) === charValue(digits.charAt(10))
  )
}

/** `characters` is the bare 14-position CNPJ, numeric or alphanumeric ([A-Z0-9]{12}\d{2}). */
export function isValidCnpj(characters: string): boolean {
  if (!/^[A-Z0-9]{12}\d{2}$/.test(characters) || isRepeatedSequence(characters)) return false
  const first = cnpjCheckDigit(characters, CNPJ_FIRST_WEIGHTS)
  if (first !== charValue(characters.charAt(12))) return false
  return cnpjCheckDigit(characters, CNPJ_SECOND_WEIGHTS) === charValue(characters.charAt(13))
}
