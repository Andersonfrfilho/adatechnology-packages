/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Cliente das rotas de contas. Fala o formato comum às APIs que expõem o `@adatechnology/expense-module` e à API
 * da transportada (mesmos caminhos, envelope `{ data }`, `competence`/`status` na lista, `paidAmount`/`paidAt` na baixa).
 */
import type { ServerEnvironment } from './expense-mcp.constant'
import type { TokenProvider } from './token-provider'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export class ExpenseApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message)
    this.name = 'ExpenseApiError'
  }
}

export type ExpenseApiClient = ReturnType<typeof createExpenseApiClient>

export function createExpenseApiClient(params: {
  readonly environment: ServerEnvironment
  readonly fetchImpl?: FetchLike
  readonly tokens: TokenProvider
}) {
  const fetchImpl = params.fetchImpl ?? fetch
  const base = params.environment.EXPENSE_API_BASE_URL.replace(/\/+$/u, '')

  async function call<T>(
    method: string,
    path: string,
    options: { body?: unknown; query?: Record<string, string | undefined> } = {},
  ): Promise<T> {
    const url = new URL(`${base}${path}`)
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== '') url.searchParams.set(key, value)
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const headers: Record<string, string> = {
        ...params.environment.EXPENSE_API_HEADERS,
        accept: 'application/json',
        authorization: `Bearer ${await params.tokens.token()}`,
      }
      if (options.body !== undefined) headers['content-type'] = 'application/json'
      const response = await fetchImpl(url.toString(), {
        headers,
        method,
        signal: AbortSignal.timeout(params.environment.EXPENSE_API_TIMEOUT_MS),
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      })
      // Token vencido do lado do servidor antes do previsto: renova uma vez.
      if (response.status === 401 && attempt === 0) {
        params.tokens.invalidate()
        continue
      }
      const text = await response.text()
      const parsed: unknown = text === '' ? undefined : safeJson(text)
      if (!response.ok) {
        const error = (parsed as { error?: { code?: unknown; message?: unknown } } | undefined)?.error
        const code = typeof error?.code === 'string' ? error.code : undefined
        const message = typeof error?.message === 'string' ? error.message : `HTTP ${response.status}`
        throw new ExpenseApiError(
          response.status,
          code,
          `${method} ${path} → ${response.status}${code ? ` ${code}` : ''}: ${message}`,
        )
      }
      const data = (parsed as { data?: unknown } | undefined)?.data
      return (data === undefined ? parsed : data) as T
    }
    throw new ExpenseApiError(401, 'UNAUTHENTICATED', `${method} ${path} → 401`)
  }

  return {
    listCategories: () => call<ApiCategory[]>('GET', '/expense-categories'),
    listExpenses: (query: { kind?: string | undefined }) => call<ApiExpense[]>('GET', '/expenses', { query }),
    createExpense: (body: Record<string, unknown>) => call<unknown>('POST', '/expenses', { body }),
    listOccurrences: (query: {
      categoryId?: string | undefined
      competence?: string | undefined
      kind?: string | undefined
      status?: string | undefined
    }) => call<ApiOccurrence[]>('GET', '/expense-occurrences', { query }),
    settleOccurrence: (id: string, body: { paidAmount: string; paidAt: string; settlementNote?: string }) =>
      call<unknown>('POST', `/expense-occurrences/${encodeURIComponent(id)}/settlement`, { body }),
    cancelOccurrence: (id: string, body: { reason: string }) =>
      call<unknown>('POST', `/expense-occurrences/${encodeURIComponent(id)}/cancellation`, { body }),
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export type ApiCategory = { readonly active?: boolean; readonly id: string; readonly name: string }
export type ApiExpense = {
  readonly active?: boolean
  readonly categoryId: string
  readonly expectedAmount: string
  readonly id: string
  readonly kind: string
  readonly name: string
  readonly recurrence?: string | null
  readonly dueDay?: number | null
}
export type ApiOccurrence = {
  readonly categoryId?: string
  readonly categoryName?: string
  readonly competence: string
  readonly dueDate: string
  readonly expectedAmount: string
  readonly expenseName?: string
  readonly id: string
  readonly paidAmount: string | null
  readonly paidAt?: string | null
  readonly status: 'open' | 'paid' | 'canceled'
}
