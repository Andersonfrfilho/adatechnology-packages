/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Servidor MCP de contas a pagar. Fala com a API do produto (nunca com o banco): a autorização, a empresa e a
 * auditoria continuam sendo da API, e o assistente só enxerga o que o usuário do token enxerga.
 */
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import {
  EXPENSE_KINDS,
  EXPENSE_OCCURRENCE_STATUSES,
  EXPENSE_RECURRENCES,
  civilDateInTimeZone,
  competenceOfDate,
  formatBrl,
  normalizeMoney,
  parseExpenseAmount,
  summarizeExpenseOccurrences,
} from '@adatechnology/expense-contracts'

import { SERVER_NAME, SERVER_VERSION, type ServerEnvironment } from './expense-mcp.constant'
import { createExpenseApiClient, ExpenseApiError, type ApiCategory, type ExpenseApiClient } from './expense-api.client'
import { createTokenProvider } from './token-provider'

const competenceText = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/u)
  .describe('Mês no formato yyyy-mm (ex.: 2026-11). Padrão: o mês corrente')
const civilDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u)

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean }

function text(value: string): ToolResult {
  return { content: [{ text: value, type: 'text' }] }
}

function json(title: string, value: unknown): ToolResult {
  return text(`${title}\n\n${JSON.stringify(value, null, 2)}`)
}

function failure(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error)
  return { content: [{ text: `Erro: ${message}`, type: 'text' }], isError: true }
}

/** Valor como a API espera (`1500.50`), aceitando o digitado em pt-BR (`R$ 1.500,50`). */
export function toApiMoney(value: string): string {
  const normalized = /,/u.test(value) ? parseExpenseAmount(value) : (normalizeMoney(value) ?? parseExpenseAmount(value))
  if (normalized === undefined || normalized === null || normalized.startsWith('-') || normalized === '0.00') {
    throw new Error(`valor inválido: ${value}`)
  }
  return normalized
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

export function resolveCategory(categories: readonly ApiCategory[], reference: string): ApiCategory {
  const byId = categories.find((category) => category.id === reference)
  if (byId) return byId
  const wanted = normalizeName(reference)
  const exact = categories.filter((category) => normalizeName(category.name) === wanted)
  if (exact.length === 1) return exact[0] as ApiCategory
  const partial = categories.filter((category) => normalizeName(category.name).includes(wanted))
  if (partial.length === 1) return partial[0] as ApiCategory
  const names = categories.map((category) => category.name).join(', ')
  throw new Error(
    partial.length > 1
      ? `categoria "${reference}" é ambígua: ${partial.map((category) => category.name).join(', ')}`
      : `categoria "${reference}" não existe. Categorias: ${names}`,
  )
}

export function createExpenseMcpServer(
  environment: ServerEnvironment,
  dependencies: { readonly api?: ExpenseApiClient; readonly now?: () => Date } = {},
): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION })
  const api = dependencies.api ?? createExpenseApiClient({ environment, tokens: createTokenProvider(environment) })
  const today = () => civilDateInTimeZone((dependencies.now ?? (() => new Date()))(), environment.EXPENSE_TIME_ZONE)

  server.registerTool(
    'list_expense_categories',
    {
      description: 'Lista as categorias de conta a pagar (Aluguel, Energia, Fornecedores…) com o id de cada uma.',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const categories = await api.listCategories()
        return json(
          `${categories.length} categoria(s).`,
          categories.map(({ id, name }) => ({ id, name })),
        )
      } catch (error) {
        return failure(error)
      }
    },
  )

  server.registerTool(
    'list_expenses',
    {
      description:
        'Lista as contas cadastradas (fixas e variáveis), com valor previsto, recorrência e dia de vencimento.',
      inputSchema: z.object({
        kind: z.enum(EXPENSE_KINDS).optional().describe('fixed (recorrente) ou variable (avulsa)'),
      }),
    },
    async ({ kind }) => {
      try {
        const expenses = await api.listExpenses({ kind })
        return json(`${expenses.length} conta(s).`, expenses)
      } catch (error) {
        return failure(error)
      }
    },
  )

  server.registerTool(
    'list_expense_occurrences',
    {
      description:
        'Lista os vencimentos de um mês: o que vence, o que já foi pago e o que está em atraso. ' +
        'Use o id do vencimento para dar baixa ou cancelar.',
      inputSchema: z.object({
        competence: competenceText.optional(),
        status: z.enum(EXPENSE_OCCURRENCE_STATUSES).optional().describe('open (em aberto), paid (pago) ou canceled'),
        categoryId: z.string().optional().describe('Filtra por categoria (id de list_expense_categories)'),
        kind: z.enum(EXPENSE_KINDS).optional(),
      }),
    },
    async ({ categoryId, competence, kind, status }) => {
      try {
        const month = competence ?? competenceOfDate(today())
        const items = await api.listOccurrences({ categoryId, competence: month, kind, status })
        return json(`${items.length} vencimento(s) em ${month}.`, items)
      } catch (error) {
        return failure(error)
      }
    },
  )

  server.registerTool(
    'summarize_expenses',
    {
      description:
        'Resumo do mês: total previsto, pago, em aberto, vencido e por categoria. ' +
        'Use para perguntas como "quanto tenho a pagar este mês" ou "o que está atrasado".',
      inputSchema: z.object({ competence: competenceText.optional() }),
    },
    async ({ competence }) => {
      try {
        const month = competence ?? competenceOfDate(today())
        const items = await api.listOccurrences({ competence: month })
        const summary = summarizeExpenseOccurrences(items, today())
        const lines = [
          `Contas de ${month} (hoje ${today()}):`,
          `- Total do mês: ${formatBrl(summary.total)}`,
          `- Pago: ${formatBrl(summary.paid)} (${summary.count.paid})`,
          `- Em aberto: ${formatBrl(summary.open)} (${summary.count.open})`,
          `- Vencido: ${formatBrl(summary.overdue)} (${summary.count.overdue})`,
          ...summary.byCategory.map(
            (row) =>
              `  • ${row.categoryName}: previsto ${formatBrl(row.expected)}, pago ${formatBrl(row.paid)}, em aberto ${formatBrl(row.open)}`,
          ),
        ]
        return json(lines.join('\n'), summary)
      } catch (error) {
        return failure(error)
      }
    },
  )

  if (environment.EXPENSE_MCP_READ_ONLY) return server

  server.registerTool(
    'create_expense',
    {
      description:
        'Lança uma conta a pagar. Fixa (recorrente: aluguel, internet) pede recorrência e dia do vencimento; ' +
        'variável (avulsa: conserto, compra) pede a data do vencimento. Confirme os dados com o usuário antes.',
      inputSchema: z.object({
        name: z.string().min(2).max(120).describe('Nome da conta, ex.: "Aluguel do galpão"'),
        category: z.string().min(1).describe('Nome ou id da categoria (ver list_expense_categories)'),
        amount: z.string().min(1).describe('Valor, ex.: "1500", "1500.50" ou "R$ 1.500,50"'),
        kind: z.enum(EXPENSE_KINDS),
        recurrence: z.enum(EXPENSE_RECURRENCES).optional().describe('Só na fixa. Padrão monthly'),
        dueDay: z.number().int().min(1).max(31).optional().describe('Dia do vencimento da fixa (menos na quinzenal)'),
        dueDate: civilDate.optional().describe('Vencimento da variável, yyyy-mm-dd'),
        installmentsTotal: z
          .number()
          .int()
          .min(2)
          .max(600)
          .optional()
          .describe('Número de parcelas da fixa, se tiver fim'),
      }),
    },
    async (input) => {
      try {
        const category = resolveCategory(await api.listCategories(), input.category)
        const body: Record<string, unknown> = {
          categoryId: category.id,
          expectedAmount: toApiMoney(input.amount),
          kind: input.kind,
          name: input.name.trim(),
        }
        if (input.kind === 'fixed') {
          const recurrence = input.recurrence ?? 'monthly'
          body['recurrence'] = recurrence
          if (recurrence !== 'fortnightly') {
            if (input.dueDay === undefined) throw new Error('conta fixa precisa de dueDay (dia do vencimento)')
            body['dueDay'] = input.dueDay
          }
          if (input.installmentsTotal !== undefined) body['installmentsTotal'] = input.installmentsTotal
        } else {
          if (input.dueDate === undefined) throw new Error('conta variável precisa de dueDate (yyyy-mm-dd)')
          body['dueDate'] = input.dueDate
        }
        const created = await api.createExpense(body)
        return json(
          `Conta "${input.name}" lançada em ${category.name} (${formatBrl(body['expectedAmount'] as string)}).`,
          created,
        )
      } catch (error) {
        return failure(error)
      }
    },
  )

  server.registerTool(
    'settle_expense_occurrence',
    {
      description:
        'Dá baixa (marca como paga) num vencimento. Use o id de list_expense_occurrences; ' +
        'sem valor informado, use o previsto daquele vencimento.',
      inputSchema: z.object({
        occurrenceId: z.string().min(1),
        paidAmount: z.string().min(1).describe('Valor pago, ex.: "450" ou "R$ 1.500,50"'),
        paidAt: civilDate.optional().describe('Data do pagamento yyyy-mm-dd. Padrão: hoje'),
        note: z.string().max(500).optional().describe('Observação (ex.: "pago por PIX")'),
      }),
    },
    async ({ note, occurrenceId, paidAmount, paidAt }) => {
      try {
        const amount = toApiMoney(paidAmount)
        const result = await api.settleOccurrence(occurrenceId, {
          paidAmount: amount,
          paidAt: paidAt ?? today(),
          ...(note === undefined ? {} : { settlementNote: note }),
        })
        return json(`Baixa registrada: ${formatBrl(amount)}.`, result)
      } catch (error) {
        return failure(error)
      }
    },
  )

  server.registerTool(
    'cancel_expense_occurrence',
    {
      description: 'Cancela um vencimento em aberto que não será pago (ex.: renegociado). Peça o motivo ao usuário.',
      inputSchema: z.object({
        occurrenceId: z.string().min(1),
        reason: z.string().min(1).max(500),
      }),
    },
    async ({ occurrenceId, reason }) => {
      try {
        return json('Vencimento cancelado.', await api.cancelOccurrence(occurrenceId, { reason }))
      } catch (error) {
        return failure(error)
      }
    },
  )

  return server
}

export { ExpenseApiError }
