/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Preço de planilha para centavos. Parece trivial e não é: a mesma coluna traz `19,90` (Excel
 * pt-BR), `19.90` (CSV exportado em en-US), `R$ 19,90` (copiado da tela) e `1.299,90` (com
 * separador de milhar). Errar aqui multiplica ou divide o preço por 100 sem ninguém notar até a
 * primeira venda.
 */

export type ParsePriceResult =
  | { readonly ok: true; readonly cents: number }
  | { readonly ok: false; readonly reason: string }

const MAX_CENTS = 100_000_000

export function parsePriceToCents(raw: string | number, locale: string): ParsePriceResult {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) return { ok: false, reason: 'Preço inválido.' }
    return { ok: true, cents: Math.round(raw * 100) }
  }

  const cleaned = raw
    .trim()
    .replace(/[^\d.,-]/g, '') // tira "R$", espaço, texto solto
    .trim()

  if (cleaned === '') return { ok: false, reason: 'Preço vazio.' }
  if (cleaned.includes('-')) return { ok: false, reason: 'Preço negativo.' }

  // Qual símbolo é o decimal depende do locale E do que a string traz. A regra que funciona nos
  // dois: o ÚLTIMO separador é o decimal quando sobram 1 ou 2 dígitos depois dele; senão os dois
  // são separador de milhar (`1.299` = mil duzentos e noventa e nove, não 1,299).
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  const lastSeparator = Math.max(lastComma, lastDot)

  let normalized: string
  if (lastSeparator === -1) {
    normalized = cleaned
  } else {
    const decimals = cleaned.length - lastSeparator - 1
    if (decimals >= 1 && decimals <= 2) {
      const integerPart = cleaned.slice(0, lastSeparator).replace(/[.,]/g, '')
      normalized = `${integerPart}.${cleaned.slice(lastSeparator + 1)}`
    } else {
      normalized = cleaned.replace(/[.,]/g, '')
    }
  }

  const value = Number(normalized)
  if (!Number.isFinite(value)) return { ok: false, reason: `Preço não reconhecido: "${raw}" (locale ${locale}).` }

  const cents = Math.round(value * 100)
  if (cents > MAX_CENTS) return { ok: false, reason: 'Preço acima do limite.' }

  return { ok: true, cents }
}
