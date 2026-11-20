/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A tabela de rotas do módulo de contas. Ela declara autorização; o despachante do host aplica.
 *
 * - `companyId` vem SEMPRE do `auth` do host, nunca do corpo nem da query.
 * - Ler (`expenses:read`) e mexer (`expenses:write`) são escopos diferentes: quem só acompanha o caixa não lança conta.
 * - Respostas no envelope `{ data }`.
 */
import { z } from 'zod'

import {
  EXPENSE_CHANNELS,
  EXPENSE_COST_GROUPS,
  EXPENSE_KINDS,
  EXPENSE_OCCURRENCE_STATUSES,
  EXPENSE_RECURRENCES,
  ExpenseError,
  competenceBounds,
  type ExpenseOccurrenceStatus,
} from '@adatechnology/expense-contracts'
import { ROUTE_SCOPE, type ModuleRoute, type ModuleRouteTable, type RequestContext } from '@adatechnology/module-http'

import type { ExpenseModule } from '../ExpenseModule'

export const EXPENSE_SCOPE = {
  READ: 'expenses:read',
  WRITE: 'expenses:write',
} as const

const civilDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'use yyyy-mm-dd')
const competence = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/u, 'use yyyy-mm')
const money = z.union([z.string().min(1).max(20), z.number().positive()]).transform((value) => String(value))
const optionalText = (max: number) => z.string().max(max).nullable().optional()

const categoryCreateSchema = z
  .object({
    costGroup: z.enum(EXPENSE_COST_GROUPS).optional(),
    displayOrder: z.number().int().min(0).max(100000).optional(),
    name: z.string().min(2).max(80),
  })
  .strict()

const categoryUpdateSchema = categoryCreateSchema.partial().extend({ active: z.boolean().optional() }).strict()

const expenseCreateSchema = z
  .object({
    anchorCompetence: competence.optional(),
    assetRef: optionalText(200),
    billUrl: optionalText(2000),
    categoryId: z.string().uuid(),
    dueDate: civilDate.optional(),
    dueDay: z.number().int().min(1).max(31).nullable().optional(),
    expectedAmount: money,
    installmentsTotal: z.number().int().min(1).max(600).nullable().optional(),
    kind: z.enum(EXPENSE_KINDS),
    name: z.string().min(2).max(120),
    notes: optionalText(2000),
    payeeName: optionalText(120),
    payeeRef: optionalText(200),
    recurrence: z.enum(EXPENSE_RECURRENCES).nullable().optional(),
    responsibleUserId: optionalText(200),
    supplier: optionalText(120),
  })
  .strict()

const expenseUpdateSchema = z
  .object({
    active: z.boolean().optional(),
    assetRef: optionalText(200),
    billUrl: optionalText(2000),
    categoryId: z.string().uuid().optional(),
    name: z.string().min(2).max(120).optional(),
    notes: optionalText(2000),
    payeeName: optionalText(120),
    payeeRef: optionalText(200),
    responsibleUserId: optionalText(200),
    supplier: optionalText(120),
  })
  .strict()

const amountChangeSchema = z
  .object({
    correctionCompetence: competence.optional(),
    effectiveFrom: competence.optional(),
    kind: z.enum(['adjustment', 'correction']).optional(),
    newAmount: money,
  })
  .strict()

const settlementSchema = z
  .object({
    settlementNote: optionalText(2000),
    paidAmount: money.optional(),
    paidAt: civilDate.optional(),
    via: z.enum(EXPENSE_CHANNELS).optional(),
  })
  .strict()

const cancellationSchema = z.object({ reason: optionalText(500) }).strict()

const listExpensesQuery = z.object({
  active: z.enum(['true', 'false']).optional(),
  categoryId: z.string().uuid().optional(),
  kind: z.enum(EXPENSE_KINDS).optional(),
  search: z.string().max(80).optional(),
})

const listOccurrencesQuery = z.object({
  /** Atalho para o mês inteiro (`yyyy-mm`); `from`/`to` vencem quando vierem juntos. */
  competence: competence.optional(),
  categoryId: z.string().uuid().optional(),
  expenseId: z.string().uuid().optional(),
  from: civilDate.optional(),
  kind: z.enum(EXPENSE_KINDS).optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
  search: z.string().max(80).optional(),
  /** Lista separada por vírgula: `open,paid`. */
  status: z
    .string()
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        value.split(',').every((item) => (EXPENSE_OCCURRENCE_STATUSES as readonly string[]).includes(item)),
      'status must be a comma-separated list of open, paid, canceled',
    ),
  to: civilDate.optional(),
})

const listCategoriesQuery = z.object({ includeInactive: z.enum(['true', 'false']).optional() })

function companyOf(context: RequestContext): string {
  const companyId = context.auth?.companyId
  if (companyId === undefined || companyId === '') throw new ExpenseError('UNAUTHENTICATED')
  return companyId
}

function actorOf(context: RequestContext): string | null {
  return context.auth?.userId ?? null
}

function idOf(context: RequestContext): string {
  const id = context.params['id'] ?? ''
  // Id que não é uuid nunca existe: responde 404 sem levar o texto ao banco (o Postgres recusaria o cast com 500).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)) return ''
  return id
}

/** `competence` vira o intervalo do mês; `from`/`to` explícitos prevalecem. */
function periodOf(query: { competence?: string | undefined; from?: string | undefined; to?: string | undefined }) {
  const bounds = query.competence === undefined ? undefined : competenceBounds(query.competence)
  return { from: query.from ?? bounds?.from, to: query.to ?? bounds?.to }
}

function ok(body: unknown, status = 200) {
  return { body: { data: body }, kind: 'json' as const, status }
}

/** Remove chaves `undefined` (o zod devolve opcional ausente como `undefined`; o serviço lê ausente como "não mexe"). */
function defined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T
}

export type CreateExpenseRoutesParams = {
  readonly module: ExpenseModule
}

export function createExpenseRoutes(params: CreateExpenseRoutesParams): ModuleRouteTable {
  const service = params.module.expenses

  async function withExpense<T>(context: RequestContext, run: (companyId: string, id: string) => Promise<T>) {
    const id = idOf(context)
    if (id === '') throw new ExpenseError('EXPENSE_NOT_FOUND')
    return run(companyOf(context), id)
  }

  async function withOccurrence<T>(context: RequestContext, run: (companyId: string, id: string) => Promise<T>) {
    const id = idOf(context)
    if (id === '') throw new ExpenseError('OCCURRENCE_NOT_FOUND')
    return run(companyOf(context), id)
  }

  const read = { requiredScopes: [EXPENSE_SCOPE.READ], scope: ROUTE_SCOPE.USER } as const
  const write = { requiredScopes: [EXPENSE_SCOPE.WRITE], scope: ROUTE_SCOPE.USER } as const

  const routes: ModuleRoute[] = [
    {
      ...read,
      method: 'GET',
      path: '/expense-categories',
      querySchema: listCategoriesQuery,
      operationId: 'listExpenseCategories',
      summary: 'Lista as categorias de conta (semeia as padrão na primeira leitura)',
      async handler(context) {
        const query = context.query as z.infer<typeof listCategoriesQuery>
        return ok(
          await service.listCategories({
            companyId: companyOf(context),
            includeInactive: query.includeInactive === 'true',
          }),
        )
      },
    },
    {
      ...write,
      method: 'POST',
      path: '/expense-categories',
      bodySchema: categoryCreateSchema,
      operationId: 'createExpenseCategory',
      summary: 'Cria uma categoria de conta',
      async handler(context) {
        const body = context.body as z.infer<typeof categoryCreateSchema>
        return ok(await service.createCategory(defined({ ...body, companyId: companyOf(context) })), 201)
      },
    },
    {
      ...write,
      method: 'PATCH',
      path: '/expense-categories/:id',
      bodySchema: categoryUpdateSchema,
      operationId: 'updateExpenseCategory',
      summary: 'Renomeia, reordena, liga ou desliga uma categoria',
      async handler(context) {
        const id = idOf(context)
        if (id === '') throw new ExpenseError('CATEGORY_NOT_FOUND')
        const body = context.body as z.infer<typeof categoryUpdateSchema>
        return ok(await service.updateCategory(defined({ ...body, companyId: companyOf(context), id })))
      },
    },
    {
      ...read,
      method: 'GET',
      path: '/expenses',
      querySchema: listExpensesQuery,
      operationId: 'listExpenses',
      summary: 'Lista as contas cadastradas (fixas e variáveis)',
      async handler(context) {
        const query = context.query as z.infer<typeof listExpensesQuery>
        return ok(
          await service.listExpenses(
            defined({
              active: query.active === undefined ? undefined : query.active === 'true',
              categoryId: query.categoryId,
              companyId: companyOf(context),
              kind: query.kind,
              search: query.search,
            }),
          ),
        )
      },
    },
    {
      ...write,
      method: 'POST',
      path: '/expenses',
      bodySchema: expenseCreateSchema,
      operationId: 'createExpense',
      summary: 'Lança uma conta; a fixa já gera os vencimentos dos próximos meses',
      async handler(context) {
        const body = context.body as z.infer<typeof expenseCreateSchema>
        const result = await service.createExpense({
          companyId: companyOf(context),
          createdBy: actorOf(context),
          createdVia: 'api',
          expense: defined(body),
        })
        return ok(result, 201)
      },
    },
    {
      ...read,
      method: 'GET',
      path: '/expenses/:id',
      operationId: 'getExpense',
      summary: 'Uma conta, com o valor em vigor neste mês',
      async handler(context) {
        return ok(await withExpense(context, (companyId, id) => service.getExpense({ companyId, id })))
      },
    },
    {
      ...write,
      method: 'PATCH',
      path: '/expenses/:id',
      bodySchema: expenseUpdateSchema,
      operationId: 'updateExpense',
      summary: 'Edita a conta; desligar cancela os vencimentos abertos de hoje em diante',
      async handler(context) {
        const body = context.body as z.infer<typeof expenseUpdateSchema>
        return ok(
          await withExpense(context, (companyId, id) =>
            service.updateExpense({ companyId, id, patch: defined(body), updatedBy: actorOf(context) }),
          ),
        )
      },
    },
    {
      ...read,
      method: 'GET',
      path: '/expenses/:id/amount-history',
      operationId: 'listExpenseAmountHistory',
      summary: 'Histórico de valor da conta (reajustes e correções)',
      async handler(context) {
        return ok(await withExpense(context, (companyId, id) => service.listAmountHistory({ companyId, id })))
      },
    },
    {
      ...write,
      method: 'POST',
      path: '/expenses/:id/amount-changes',
      bodySchema: amountChangeSchema,
      operationId: 'changeExpenseAmount',
      summary: 'Reajusta ou corrige o valor da conta, com histórico',
      async handler(context) {
        const body = context.body as z.infer<typeof amountChangeSchema>
        const result = await withExpense(context, (companyId, id) =>
          service.changeAmount(defined({ ...body, changedBy: actorOf(context) ?? 'api', companyId, id })),
        )
        return ok(result, result.change === null ? 200 : 201)
      },
    },
    {
      ...read,
      method: 'GET',
      path: '/expense-occurrences',
      querySchema: listOccurrencesQuery,
      operationId: 'listExpenseOccurrences',
      summary: 'Lista os vencimentos por período, situação, categoria ou conta',
      async handler(context) {
        const query = context.query as z.infer<typeof listOccurrencesQuery>
        return ok(
          await service.listOccurrences(
            defined({
              categoryId: query.categoryId,
              expenseId: query.expenseId,
              kind: query.kind,
              limit: query.limit,
              search: query.search,
              ...periodOf(query),
              companyId: companyOf(context),
              status: query.status?.split(',') as ExpenseOccurrenceStatus[] | undefined,
            }),
          ),
        )
      },
    },
    {
      ...read,
      method: 'GET',
      path: '/expense-occurrences/:id',
      operationId: 'getExpenseOccurrence',
      summary: 'Um vencimento',
      async handler(context) {
        return ok(await withOccurrence(context, (companyId, id) => service.getOccurrence({ companyId, id })))
      },
    },
    {
      ...read,
      method: 'GET',
      path: '/expense-summary',
      querySchema: listOccurrencesQuery,
      operationId: 'summarizeExpenses',
      summary: 'Resumo do período: previsto, pago, em aberto, vencido e por categoria',
      async handler(context) {
        const query = context.query as z.infer<typeof listOccurrencesQuery>
        return ok(
          await service.summarize(
            defined({
              categoryId: query.categoryId,
              companyId: companyOf(context),
              expenseId: query.expenseId,
              kind: query.kind,
              search: query.search,
              ...periodOf(query),
            }),
          ),
        )
      },
    },
    {
      ...write,
      method: 'POST',
      path: '/expense-occurrences/:id/settlement',
      bodySchema: settlementSchema,
      operationId: 'settleExpenseOccurrence',
      summary: 'Dá baixa no vencimento (valor e data do pagamento)',
      async handler(context) {
        const body = context.body as z.infer<typeof settlementSchema>
        return ok(
          await withOccurrence(context, (companyId, id) =>
            service.settleOccurrence(
              defined({ ...body, companyId, id, paidBy: actorOf(context), via: body.via ?? 'api' }),
            ),
          ),
        )
      },
    },
    {
      ...write,
      method: 'DELETE',
      path: '/expense-occurrences/:id/settlement',
      operationId: 'reopenExpenseOccurrence',
      summary: 'Desfaz a baixa (pagamento lançado por engano)',
      async handler(context) {
        return ok(await withOccurrence(context, (companyId, id) => service.reopenOccurrence({ companyId, id })))
      },
    },
    {
      ...write,
      method: 'POST',
      path: '/expense-occurrences/:id/cancellation',
      bodySchema: cancellationSchema,
      operationId: 'cancelExpenseOccurrence',
      summary: 'Cancela um vencimento aberto',
      async handler(context) {
        const body = context.body as z.infer<typeof cancellationSchema>
        return ok(
          await withOccurrence(context, (companyId, id) =>
            service.cancelOccurrence(defined({ companyId, id, reason: body.reason })),
          ),
        )
      },
    },
  ]
  return routes
}
