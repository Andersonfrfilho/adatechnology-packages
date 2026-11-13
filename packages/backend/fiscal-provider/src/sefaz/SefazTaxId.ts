/**
 * CNPJ alfanumérico (IN RFB 2229/2024, NT Conjunta DF-e 2025.001, em produção desde 01/07/2026).
 *
 * O valor de cada caractere no módulo 11 é `charCodeAt(0) - 48`, e é essa definição que faz o CNPJ
 * numérico existente calcular exatamente como sempre calculou. Nunca normalizar CNPJ por
 * `replace(/\D/g, '')`: a letra some sem erro e o documento passa a apontar para outro
 * contribuinte.
 */

/** Máscara normativa do CNPJ (Anexo I da NT); o espaço entra por conveniência de formulário. */
const MASK_CHARACTERS = /[./\-\s]/g

const ZERO_CHAR_CODE = '0'.charCodeAt(0)

/** Vetor único do Anexo I: o 1º DV usa `[i + 1]`, o 2º usa `[i]`. */
const CNPJ_DV_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const

const CNPJ_BASE_LENGTH = 12
const CHAVE_BASE_LENGTH = 43
const ZEROED_CNPJ_BASE = '000000000000'

/** CNPJ completo: 12 posições alfanuméricas maiúsculas + 2 dígitos verificadores numéricos. */
export const CNPJ_PATTERN = /^[A-Z0-9]{12}[0-9]{2}$/u

/** Chave de acesso: cUF+AAMM numéricos, CNPJ do emitente alfanumérico, o resto numérico. */
export const CHAVE_PATTERN = /^[0-9]{6}[A-Z0-9]{12}[0-9]{26}$/u

const CNPJ_BASE_PATTERN = /^[A-Z0-9]{12}$/u
const CHAVE_BASE_PATTERN = /^[0-9]{6}[A-Z0-9]{12}[0-9]{25}$/u

export function charValue(character: string): number {
  return character.charCodeAt(0) - ZERO_CHAR_CODE
}

/**
 * Tira a máscara e sobe a caixa. Não remove caractere desconhecido — quem chama valida contra
 * `CNPJ_PATTERN` e rejeita, porque remover em silêncio é o defeito que esta função existe para
 * eliminar.
 */
export function normalizeTaxId(value: string): string {
  return value.replace(MASK_CHARACTERS, '').toUpperCase()
}

export function calcularDvCnpj(base: string): string {
  if (!CNPJ_BASE_PATTERN.test(base) || base === ZEROED_CNPJ_BASE) {
    throw new Error(`CNPJ inválido para cálculo do DV: ${base}`)
  }

  let firstSum = 0
  let secondSum = 0
  for (let index = 0; index < CNPJ_BASE_LENGTH; index++) {
    const value = charValue(base[index]!)
    firstSum += value * CNPJ_DV_WEIGHTS[index + 1]!
    secondSum += value * CNPJ_DV_WEIGHTS[index]!
  }

  const firstDv = resolveModulo11(firstSum)
  secondSum += firstDv * CNPJ_DV_WEIGHTS[CNPJ_BASE_LENGTH]!

  return `${firstDv}${resolveModulo11(secondSum)}`
}

/** Módulo 11 com pesos 2→9 ciclando da direita para a esquerda (Anexo II da NT). */
export function calcularDvChave(base: string): string {
  if (!CHAVE_BASE_PATTERN.test(base)) {
    throw new Error(`chave de acesso inválida para cálculo do DV: ${base}`)
  }

  let sum = 0
  let weight = 2
  for (let index = CHAVE_BASE_LENGTH - 1; index >= 0; index--) {
    sum += charValue(base[index]!) * weight
    weight = weight > 8 ? 2 : weight + 1
  }

  return String(resolveModulo11(sum))
}

export function isCnpjValid(value: string): boolean {
  const normalized = normalizeTaxId(value)
  if (!CNPJ_PATTERN.test(normalized)) return false
  const base = normalized.slice(0, CNPJ_BASE_LENGTH)
  if (base === ZEROED_CNPJ_BASE) return false
  return calcularDvCnpj(base) === normalized.slice(CNPJ_BASE_LENGTH)
}

/**
 * Pontuação para impressão (DANFE, cupom). Devolve o valor recebido intacto quando ele não é um
 * CNPJ — impresso, um documento truncado é indistinguível de um documento real, e ninguém do outro
 * lado do balcão tem como perceber.
 */
export function formatCnpjForDisplay(value: string): string {
  const taxId = normalizeTaxId(value)
  if (!CNPJ_PATTERN.test(taxId)) return value
  return `${taxId.slice(0, 2)}.${taxId.slice(2, 5)}.${taxId.slice(5, 8)}/${taxId.slice(8, 12)}-${taxId.slice(12)}`
}

function resolveModulo11(sum: number): number {
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}
