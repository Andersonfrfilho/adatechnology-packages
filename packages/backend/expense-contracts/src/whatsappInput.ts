/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O que a pessoa digita no chat (WhatsApp, Telegram, bot do painel) vira valor, data e dia da conta. Funções puras.
 */
import { addCivilDays, formatCents, isCivilDate } from './money'

const MAX_CENTS = 99_999_999_999n

/** Texto sem acento, minúsculo, só letras/números/espaço. */
export function normalizeChatText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

/** `R$ 1.500,50` / `1500` / `89,9` → `'1500.50'`; `undefined` quando não é valor positivo. */
export function parseExpenseAmount(text: string): string | undefined {
  const cleaned = text
    .replace(/r\$/giu, '')
    .replace(/\s+/gu, '')
    .replace(/\.(?=\d{3}(?:\D|$))/gu, '')
    .replace(',', '.')
  const match = /^(\d+)(?:\.(\d{1,2}))?$/u.exec(cleaned)
  if (match?.[1] === undefined) return undefined
  const cents = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0')
  if (cents <= 0n || cents > MAX_CENTS) return undefined
  return formatCents(cents)
}

/** `hoje`, `amanhã`, `dd/mm` (próxima ocorrência a partir de hoje) e `dd/mm/aaaa`. `today` é injetado. */
export function parseExpenseDueDate(text: string, today: string): string | undefined {
  const normalized = text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
  if (normalized === 'hoje') return today
  if (normalized === 'amanha') return addCivilDays(today, 1)
  const match = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/u.exec(normalized)
  if (match?.[1] === undefined || match[2] === undefined) return undefined
  const day = match[1].padStart(2, '0')
  const month = match[2].padStart(2, '0')
  if (match[3] !== undefined) {
    const full = `${match[3]}-${month}-${day}`
    return isCivilDate(full) ? full : undefined
  }
  const year = Number(today.slice(0, 4))
  const thisYear = `${year}-${month}-${day}`
  if (!isCivilDate(thisYear)) return undefined
  if (thisYear >= today) return thisYear
  const nextYear = `${year + 1}-${month}-${day}`
  return isCivilDate(nextYear) ? nextYear : undefined
}

/** `5` ou `dia 10` → 1..31. */
export function parseExpenseDueDay(text: string): number | undefined {
  const match = /^(?:dia\s*)?(\d{1,2})$/iu.exec(text.trim())
  if (match?.[1] === undefined) return undefined
  const day = Number(match[1])
  return day >= 1 && day <= 31 ? day : undefined
}

const FINANCE_WORDS = /\b(contas?|boletos?|pagar|pagamentos?|lancar|despesas?|financeiro)\b/u
const OPENING_WORDS = /^(oi+|ola+|menu|opcoes?|ajuda|bom dia|boa tarde|boa noite|e ai|eai|inicio|comecar)$/u

/**
 * A mensagem fala de conta ou só abre a conversa ("oi", "menu"): vai ao assistente financeiro. "baixa" sozinha fica de
 * fora (equipe de campo também dá baixa em entrega).
 */
export function isDirectExpenseIntent(text: string): boolean {
  const normalized = normalizeChatText(text)
  if (normalized === '') return false
  return FINANCE_WORDS.test(normalized) || OPENING_WORDS.test(normalized)
}

/**
 * Versão mais estreita, para quem também é equipe de campo: "boleto" sozinho pode ser outra coisa e "lançar" sozinho
 * pode ser "lançar a entrega".
 */
const FIELD_FINANCE_WORDS = /\b(contas?|despesas?|financeiro)\b|\b(lancar|pagar|cadastrar)\s+(um\s+|uma\s+)?boletos?\b/u

export function isFieldStaffFinanceIntent(text: string): boolean {
  return FIELD_FINANCE_WORDS.test(normalizeChatText(text))
}

/** "paguei", "já paguei 150,00", "pago": a resposta que dá baixa num aviso. Valor opcional. */
export function parseSettlementReply(text: string): { readonly amount?: string } | null {
  const normalized = normalizeChatText(text)
  if (!/\b(ja\s+)?(paguei|pago|quitei|quitado|pagamos)\b/u.test(normalized)) return null
  if (/\b(nao|ainda nao)\s+(paguei|pago|quitei)\b/u.test(normalized)) return null
  const amountMatch = /(r\$\s*)?\d[\d.,]*/iu.exec(text)
  const amount = amountMatch === null ? undefined : parseExpenseAmount(amountMatch[0])
  return amount === undefined ? {} : { amount }
}
