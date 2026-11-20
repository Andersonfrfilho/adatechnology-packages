/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Os valores de texto do aviso de conta a vencer e do resumo diário (pt-BR), e os blocos de HTML do sistema que um
 * modelo de e-mail pode usar. Puro. O layout do e-mail é do modelo do produto; aqui só nascem os valores (escapados
 * na saída) e dois blocos (botão, tabela) que escapam tudo o que carregam.
 */
import { formatBrl, parseMoneyToCents } from './money'
import { civilDaysBetween } from './reminder'

const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/gu
const EMPTY_FIELD = '—'

const HTML_ESCAPE_MAP: Readonly<Record<string, string>> = {
  '"': '&quot;',
  '&': '&amp;',
  "'": '&#39;',
  '<': '&lt;',
  '>': '&gt;',
}

/** Mesmo escape de `@adatechnology/notification-contracts` (`escapeEmailHtml`). */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => HTML_ESCAPE_MAP[character] ?? character)
}

/** `'2026-11-17'` → `'17/11/2026'`. */
export function formatCivilDateBr(value: string): string {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

/** `'2026-11'` → `'11/2026'`. */
export function formatCompetenceBr(value: string): string {
  const [year, month] = value.split('-')
  return `${month}/${year}`
}

/** A frase do prazo, do jeito que o aviso diz. */
export function describeDueSituation(daysUntilDue: number): string {
  if (daysUntilDue > 1) return `vence em ${daysUntilDue} dias`
  if (daysUntilDue === 1) return 'vence amanhã'
  if (daysUntilDue === 0) return 'vence hoje'
  if (daysUntilDue === -1) return 'venceu ontem'
  return `venceu há ${-daysUntilDue} dias`
}

export type ExpenseReminderFacts = {
  readonly amount: string
  readonly categoryName: string
  readonly companyDisplayName: string
  readonly competence: string
  readonly dueDate: string
  readonly expenseName: string
  readonly payeeName: string | null
  readonly recipientName: string
  readonly today: string
}

export type ExpenseTextOptions = {
  /** Nome da variável que leva o nome da empresa no modelo (padrão `empresa`; a transportadora usa `transportadora`). */
  readonly companyVariable?: string
}

/** Os valores de texto do aviso de uma conta (e-mail e WhatsApp usam os mesmos). */
export function buildExpenseReminderValues(
  facts: ExpenseReminderFacts,
  options: ExpenseTextOptions = {},
): Readonly<Record<string, string>> {
  return {
    categoria: facts.categoryName,
    competencia: formatCompetenceBr(facts.competence),
    conta: facts.expenseName,
    favorecido: facts.payeeName ?? EMPTY_FIELD,
    responsavel: facts.recipientName,
    situacao: describeDueSituation(civilDaysBetween(facts.today, facts.dueDate)),
    valor: formatBrl(facts.amount),
    vencimento: formatCivilDateBr(facts.dueDate),
    [options.companyVariable ?? 'empresa']: facts.companyDisplayName,
  }
}

export type ExpenseSummaryLine = {
  readonly amount: string
  readonly dueDate: string
  readonly expenseName: string
}

/** Os valores de texto do resumo diário. */
export function buildExpenseDailySummaryValues(
  input: {
    readonly companyDisplayName: string
    readonly lines: readonly ExpenseSummaryLine[]
    readonly recipientName: string
    readonly today: string
  },
  options: ExpenseTextOptions = {},
): Readonly<Record<string, string>> {
  const total = input.lines.reduce((sum, line) => sum + (parseMoneyToCents(line.amount) ?? 0n), 0n)
  const count = input.lines.length
  return {
    dia: formatCivilDateBr(input.today),
    quantidade: `${count} ${count === 1 ? 'conta' : 'contas'}`,
    responsavel: input.recipientName,
    totalAberto: formatBrl(total),
    [options.companyVariable ?? 'empresa']: input.companyDisplayName,
  }
}

export type ExpenseMailPalette = {
  readonly border: string
  readonly muted: string
  readonly primary: string
  readonly text: string
}

export const DEFAULT_EXPENSE_MAIL_PALETTE: ExpenseMailPalette = {
  border: '#e6e1d8',
  muted: '#6b7c85',
  primary: '#d58a47',
  text: '#10222c',
}

/** Um botão "à prova de Outlook" (tabela, sem CSS moderno). Sem URL https, nada: a variável sai vazia. */
export function buildExpenseMailButtonHtml(input: {
  readonly label: string
  readonly palette?: ExpenseMailPalette
  readonly primary: boolean
  readonly url: string | null
}): string {
  if (input.url === null || !/^https:\/\//u.test(input.url)) return ''
  const palette = input.palette ?? DEFAULT_EXPENSE_MAIL_PALETTE
  const background = input.primary ? palette.primary : '#ffffff'
  const border = input.primary ? palette.primary : palette.text
  return [
    '<tr><td style="padding:8px 28px">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>',
    `<td style="background:${background};border:1px solid ${border};padding:12px 22px;">`,
    `<a href="${escapeHtml(input.url)}" style="color:${palette.text};font-size:15px;font-weight:bold;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(input.label)}</a>`,
    '</td></tr></table>',
    '</td></tr>',
  ].join('')
}

/** A tabela do resumo, uma linha por conta, na ordem recebida. */
export function buildExpenseSummaryTableHtml(input: {
  readonly lines: readonly ExpenseSummaryLine[]
  readonly palette?: ExpenseMailPalette
  readonly today: string
}): string {
  const palette = input.palette ?? DEFAULT_EXPENSE_MAIL_PALETTE
  const rows = input.lines.map((line, index) => {
    const border = index === 0 ? '' : `border-top:1px solid ${palette.border};`
    const situation = describeDueSituation(civilDaysBetween(input.today, line.dueDate))
    return [
      '<tr>',
      `<td style="padding:10px 14px;${border}font-weight:bold;">${escapeHtml(line.expenseName)}</td>`,
      `<td style="padding:10px 14px;${border}color:${palette.muted};">${escapeHtml(`${formatCivilDateBr(line.dueDate)} · ${situation}`)}</td>`,
      `<td style="padding:10px 14px;${border}text-align:right;white-space:nowrap;">${escapeHtml(formatBrl(line.amount))}</td>`,
      '</tr>',
    ].join('')
  })
  return [
    '<tr><td style="padding:8px 28px">',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${palette.border};font-size:14px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;color:${palette.text};">`,
    ...rows,
    '</table>',
    '</td></tr>',
  ].join('')
}

/** Interpola `{{nome}}` num texto sem HTML (WhatsApp, push): valor cru, desconhecido sai vazio. Uma passada só. */
export function renderPlainTemplate(body: string, values: Readonly<Record<string, string>>): string {
  return body
    .replace(PLACEHOLDER_REGEX, (_match, name: string) => (Object.hasOwn(values, name) ? (values[name] ?? '') : ''))
    .trim()
}

/** Texto padrão do aviso por WhatsApp, para o produto que ainda não tem modelo próprio. */
export const DEFAULT_EXPENSE_REMINDER_WHATSAPP_TEXT = [
  '💸 *Conta {{situacao}}*',
  '',
  '*{{conta}}* ({{categoria}})',
  'Valor: {{valor}}',
  'Vencimento: {{vencimento}}',
  '',
  'Já pagou? Responda *paguei* para dar baixa.',
].join('\n')

/** Texto padrão do resumo diário por WhatsApp. */
export const DEFAULT_EXPENSE_SUMMARY_WHATSAPP_TEXT = [
  '📋 *Contas de {{dia}}*',
  '',
  '{{quantidade}} vencendo hoje ou em atraso, total de {{totalAberto}}.',
].join('\n')
