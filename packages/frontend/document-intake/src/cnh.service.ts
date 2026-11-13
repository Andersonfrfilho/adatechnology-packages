/**
 * Spec 071: a CNH-e é imagem embrulhada em PDF pelo invólucro do Serpro — medido: ~400 caracteres
 * de texto legal e nenhum campo. Ler exige OCR, que é servidor, que é assíncrono. Por isso esta
 * leitura **não** preenche formulário aberto: ela alimenta a conferência do operador.
 *
 * Extração por heurística sobre texto de OCR genérico (Tesseract self-hosted, sem leitor de CNH
 * dedicado) — não é leitura oficial de documento, é melhor palpite. Sobe para o pacote porque duas
 * apps a executam: a API, no anexo que o operador já cadastrou, e o worker, no anexo que chegou da
 * landing. ADR-0054 do `transportada`.
 */

/**
 * As categorias como o CONTRAN as publica, na ordem em que a habilitação sobe: `ACC` é o ciclomotor,
 * e as compostas são as duas letras juntas porque é assim que o documento as imprime. É catálogo
 * nacional, não catálogo de app — por isso pode morar aqui.
 */
export const CNH_LICENSE_CATEGORIES = ['ACC', 'A', 'B', 'AB', 'C', 'AC', 'D', 'AD', 'E', 'AE'] as const

export type CnhLicenseCategory = (typeof CNH_LICENSE_CATEGORIES)[number]

export type CnhFields = Readonly<{
  licenseCategory: CnhLicenseCategory | null
  licenseNumber: string | null
  name: string | null
}>

/**
 * Ancorado no rótulo, nunca no formato: CPF e RENAVAM também têm onze dígitos, e na CNH-e o CPF vem
 * impresso **antes** do registro. Sem âncora, o primeiro número da página virava "a CNH" e a
 * conferência acusava divergência num documento correto — o oposto do que ela existe para fazer.
 */
const LICENSE_NUMBER_LABEL_PATTERN = /(?:registro|habilita[çc][ãa]o)\D{0,12}(\d{11})\b/i
const CATEGORY_LABEL_PATTERN = /cat(?:egoria)?[.\s]*(?:hab[.\s]*)?[:\s]+([A-E]{1,2})\b/i
/** Só o resto da MESMA linha do rótulo — sem isso, "NOME" engole a linha seguinte inteira. */
const NAME_LABEL_PATTERN = /nome\s*[:]?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]{2,60})/i

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/gu, ' ').trim()
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => (word[0]?.toUpperCase() ?? '') + word.slice(1))
    .join(' ')
}

function extractNameFromLine(rawText: string): string | null {
  const line = rawText.split('\n').find((candidate) => NAME_LABEL_PATTERN.test(candidate))
  if (line === undefined) return null

  const matched = NAME_LABEL_PATTERN.exec(line)

  return matched?.[1] ? toTitleCase(normalizeWhitespace(matched[1])) : null
}

function isLicenseCategory(value: string | null): value is CnhLicenseCategory {
  return value !== null && (CNH_LICENSE_CATEGORIES as readonly string[]).includes(value)
}

export function extractCnhFields(rawText: string): CnhFields {
  const name = extractNameFromLine(rawText)
  const text = normalizeWhitespace(rawText)

  const category = CATEGORY_LABEL_PATTERN.exec(text)?.[1]?.toUpperCase() ?? null

  return {
    licenseCategory: isLicenseCategory(category) ? category : null,
    licenseNumber: LICENSE_NUMBER_LABEL_PATTERN.exec(text)?.[1] ?? null,
    name,
  }
}
