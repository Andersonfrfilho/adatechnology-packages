export interface RedactOptions {
  extraKeys?: string[]
  maxDepth?: number
}

const REDACTED = '[REDACTED]'
const TRUNCATED = '[TRUNCATED]'
const CIRCULAR = '[CIRCULAR]'
const DEFAULT_MAX_DEPTH = 8

/**
 * Nome de chave, normalizado. Casa por igualdade ou por sufixo: `clienteCpf` cai em `cpf`,
 * mas `enderecoId` não cai em `endereco` — sufixo evita perder identificador opaco.
 */
export const DEFAULT_REDACTED_KEYS = [
  'cpf',
  'cnpj',
  'email',
  'phone',
  'telefone',
  'celular',
  'whatsapp',
  'password',
  'senha',
  'secret',
  'token',
  'apikey',
  'authorization',
  'cookie',
  'certificate',
  'certificado',
  'privatekey',
  'pfx',
  'xml',
  'razaosocial',
  'nomefantasia',
  'endereco',
  'logradouro',
  'bairro',
  'cep',
] as const

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
const ACCESS_KEY_PATTERN = /(?<![A-Za-z0-9])[0-9]{6}[A-Za-z0-9]{12}[0-9]{26}(?![A-Za-z0-9])/g
const CNPJ_FORMATTED_PATTERN =
  /(?<![A-Za-z0-9])[A-Za-z0-9]{2}\.[A-Za-z0-9]{3}\.[A-Za-z0-9]{3}\/[A-Za-z0-9]{4}-\d{2}(?!\d)/g
const CPF_FORMATTED_PATTERN = /(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/g
const PHONE_COUNTRY_CODE_PATTERN = /\+\d{1,3}[\s-]?\d{2}[\s-]?9?\d{4}[\s-]?\d{4}(?!\d)/g
const PHONE_PARENTHESES_PATTERN = /\(\d{2}\)\s?9?\d{4}[\s-]?\d{4}(?!\d)/g
const PHONE_SEPARATED_PATTERN = /(?<![\d.])\d{2}[\s-]9\d{4}[\s-]?\d{4}(?!\d)/g
const CNPJ_BARE_PATTERN = /(?<!\d)\d{14}(?!\d)/g
const CNPJ_ALPHANUMERIC_BARE_PATTERN = /(?<![A-Za-z0-9])[A-Za-z0-9]{12}\d{2}(?![A-Za-z0-9])/g
const CPF_BARE_PATTERN = /(?<!\d)\d{11}(?!\d)/g

const ACCESS_KEY_VISIBLE_DIGITS = 6

/**
 * Módulo 11 do CNPJ alfanumérico (IN RFB 2229/2024), escrito aqui de propósito. Este pacote não
 * declara dependência de runtime nenhuma, e quem o consome é produto de conversa, de catálogo, de
 * fiscal — importar o `fiscal-provider` só para redigir log arrastaria `pdfkit`, `xml-crypto` e
 * `node-forge` para dentro de todos eles.
 */
const CNPJ_DV_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const
const CNPJ_BASE_LENGTH = 12
const ZERO_CHAR_CODE = '0'.charCodeAt(0)

function resolveModulo11(sum: number): number {
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

function hasValidCnpjCheckDigits(taxId: string): boolean {
  let firstSum = 0
  let secondSum = 0
  for (let index = 0; index < CNPJ_BASE_LENGTH; index += 1) {
    const value = taxId.charCodeAt(index) - ZERO_CHAR_CODE
    firstSum += value * CNPJ_DV_WEIGHTS[index + 1]!
    secondSum += value * CNPJ_DV_WEIGHTS[index]!
  }

  const firstDigit = resolveModulo11(firstSum)
  secondSum += firstDigit * CNPJ_DV_WEIGHTS[CNPJ_BASE_LENGTH]!

  return `${firstDigit}${resolveModulo11(secondSum)}` === taxId.slice(CNPJ_BASE_LENGTH)
}

/**
 * Catorze posições soltas com letra é a forma de um CNPJ alfanumérico — e também a de um id opaco.
 * Sem pontuação em volta não há mais nada separando os dois, então o dígito verificador é a
 * evidência: sem ele, `01J8Z9ABCDEF12` viraria `[CNPJ_REDACTED]` e o log deixaria de diagnosticar.
 * A forma puramente numérica continua sendo tratada pelo padrão de sempre, sem conferir DV — mudar
 * aquilo seria regressão, e catorze dígitos seguidos já são documento em praticamente todo log.
 */
function redactAlphanumericCnpj(match: string): string {
  if (!/[A-Za-z]/.test(match)) return match
  return hasValidCnpjCheckDigits(match.toUpperCase()) ? '[CNPJ_REDACTED]' : match
}

function maskAccessKey(accessKey: string): string {
  return `****${accessKey.slice(-ACCESS_KEY_VISIBLE_DIGITS)}`
}

/**
 * A ordem é o contrato: a chave de acesso carrega o CNPJ do emitente nos catorze dígitos do meio,
 * então ela tem de ser consumida antes dos padrões mais curtos.
 */
function redactString(value: string): string {
  return value
    .replace(EMAIL_PATTERN, '[EMAIL_REDACTED]')
    .replace(ACCESS_KEY_PATTERN, maskAccessKey)
    .replace(CNPJ_FORMATTED_PATTERN, '[CNPJ_REDACTED]')
    .replace(CPF_FORMATTED_PATTERN, '[CPF_REDACTED]')
    .replace(PHONE_COUNTRY_CODE_PATTERN, '[PHONE_REDACTED]')
    .replace(PHONE_PARENTHESES_PATTERN, '[PHONE_REDACTED]')
    .replace(PHONE_SEPARATED_PATTERN, '[PHONE_REDACTED]')
    .replace(CNPJ_BARE_PATTERN, '[CNPJ_REDACTED]')
    .replace(CNPJ_ALPHANUMERIC_BARE_PATTERN, redactAlphanumericCnpj)
    .replace(CPF_BARE_PATTERN, '[CPF_REDACTED]')
}

function redactNumber(value: number): string | number {
  if (!Number.isInteger(value)) return value

  const digits = String(value)
  if (digits.length !== 11 && digits.length !== 14 && digits.length !== 44) return value

  return redactString(digits)
}

function normalizeKey(key: string): string {
  return key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function buildDeniedKeys(extraKeys?: string[]): string[] {
  if (!extraKeys || extraKeys.length === 0) return DEFAULT_REDACTED_KEYS as unknown as string[]

  return [...DEFAULT_REDACTED_KEYS, ...extraKeys.map(normalizeKey)]
}

function isDeniedKey(key: string, deniedKeys: string[]): boolean {
  const normalized = normalizeKey(key)

  return deniedKeys.some((denied) => normalized === denied || normalized.endsWith(denied))
}

interface RedactState {
  deniedKeys: string[]
  maxDepth: number
  ancestors: Set<object>
}

function redactValue(value: unknown, depth: number, state: RedactState): unknown {
  if (value === null || value === undefined) return value

  const kind = typeof value
  if (kind === 'string') return redactString(value as string)
  if (kind === 'number') return redactNumber(value as number)
  if (kind === 'boolean') return value
  if (kind === 'bigint') return (value as bigint).toString()
  if (kind === 'symbol') return (value as symbol).toString()
  if (kind === 'function') return '[Function]'

  const objectValue = value as object
  if (objectValue instanceof Date) return objectValue
  if (state.ancestors.has(objectValue)) return CIRCULAR
  if (depth >= state.maxDepth) return TRUNCATED

  state.ancestors.add(objectValue)
  try {
    if (objectValue instanceof Error) return redactError(objectValue)
    if (Array.isArray(objectValue)) {
      return objectValue.map((item) => redactValue(item, depth + 1, state))
    }
    return redactRecord(objectValue as Record<string, unknown>, depth, state)
  } finally {
    state.ancestors.delete(objectValue)
  }
}

function redactError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: redactString(error.message),
    ...(error.stack && { stack: redactString(error.stack) }),
  }
}

function redactRecord(record: Record<string, unknown>, depth: number, state: RedactState): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, entry] of Object.entries(record)) {
    result[key] = isDeniedKey(key, state.deniedKeys) ? REDACTED : redactValue(entry, depth + 1, state)
  }

  return result
}

function createState(options?: RedactOptions): RedactState {
  return {
    deniedKeys: buildDeniedKeys(options?.extraKeys),
    maxDepth: options?.maxDepth ?? DEFAULT_MAX_DEPTH,
    ancestors: new Set<object>(),
  }
}

export function redact(value: string, options?: RedactOptions): string
export function redact(value: unknown, options?: RedactOptions): unknown
export function redact(value: unknown, options?: RedactOptions): unknown {
  return redactValue(value, 0, createState(options))
}

export function redactMeta(meta: Record<string, unknown>, options?: RedactOptions): Record<string, unknown> {
  const state = createState(options)
  state.ancestors.add(meta)

  return redactRecord(meta, 0, state)
}
