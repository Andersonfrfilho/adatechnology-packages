/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O vocabulário do módulo de contas: conta (fixa ou variável), ocorrência (o que vence), categoria e mudança de valor.
 * Dinheiro é texto com duas casas; datas civis são `yyyy-mm-dd` e competências `yyyy-mm`.
 */

export const EXPENSE_KINDS = ['fixed', 'variable'] as const
export type ExpenseKind = (typeof EXPENSE_KINDS)[number]

/** `fortnightly` (quinzenal) vence nos dias 15 e no último dia do mês. */
export const EXPENSE_RECURRENCES = ['monthly', 'bimonthly', 'quarterly', 'yearly', 'fortnightly'] as const
export type ExpenseRecurrence = (typeof EXPENSE_RECURRENCES)[number]

export const EXPENSE_OCCURRENCE_STATUSES = ['open', 'paid', 'canceled'] as const
export type ExpenseOccurrenceStatus = (typeof EXPENSE_OCCURRENCE_STATUSES)[number]

/** `adjustment` = reajuste com vigência; `correction` = valor digitado errado, corrigido (o antigo fica no histórico). */
export const EXPENSE_AMOUNT_CHANGE_KINDS = ['adjustment', 'correction'] as const
export type ExpenseAmountChangeKind = (typeof EXPENSE_AMOUNT_CHANGE_KINDS)[number]

/** Canal por onde a conta entrou ou foi baixada. */
export const EXPENSE_CHANNELS = ['panel', 'whatsapp', 'email', 'api'] as const
export type ExpenseChannel = (typeof EXPENSE_CHANNELS)[number]

/**
 * Grupo de custo da categoria, para o rateio entre unidades de trabalho (viagem, pedido, atendimento).
 * - `asset_fixed`: custo fixo de um bem (seguro, IPVA, parcela do veículo);
 * - `per_distance`: custo que anda com a distância (combustível, pneu);
 * - `administrative`: custo da empresa (aluguel, contador);
 * - `in_unit`: já está no custo da unidade (diária do motorista); nunca é rateado de novo.
 */
export const EXPENSE_COST_GROUPS = ['asset_fixed', 'per_distance', 'administrative', 'in_unit'] as const
export type ExpenseCostGroup = (typeof EXPENSE_COST_GROUPS)[number]

export type ExpenseCategory = {
  readonly active: boolean
  readonly costGroup: ExpenseCostGroup
  readonly displayOrder: number
  readonly id: string
  readonly name: string
}

export type Expense = {
  readonly active: boolean
  /** `yyyy-mm` em que a conta começou: bimestral/trimestral/anual contam a partir dele. */
  readonly anchorCompetence: string
  readonly categoryId: string
  readonly companyId: string
  readonly createdAt: string
  /** 1–31 na fixa (menos a quinzenal); nulo na variável. */
  readonly dueDay: number | null
  /** Valor de abertura; o valor de uma competência sai de `amountInEffect` com o histórico. */
  readonly expectedAmount: string
  readonly id: string
  /** Total de parcelas da fixa; nulo = sem fim. */
  readonly installmentsTotal: number | null
  readonly kind: ExpenseKind
  readonly name: string
  readonly notes: string | null
  /** Referências opacas do produto: quem recebe, qual bem, quem é responsável. O módulo nunca as interpreta. */
  readonly assetRef: string | null
  readonly payeeRef: string | null
  readonly payeeName: string | null
  readonly recurrence: ExpenseRecurrence | null
  readonly responsibleUserId: string | null
  readonly supplier: string | null
  readonly billUrl: string | null
}

export type ExpenseOccurrence = {
  readonly cancelReason: string | null
  readonly canceledAt: string | null
  readonly companyId: string
  /** `yyyy-mm`. */
  readonly competence: string
  /** `yyyy-mm-dd`. */
  readonly dueDate: string
  readonly expectedAmount: string
  readonly expenseId: string
  readonly id: string
  readonly installmentNumber: number | null
  readonly paidAmount: string | null
  /** `yyyy-mm-dd` do pagamento. */
  readonly paidAt: string | null
  readonly paidBy: string | null
  readonly settledVia: ExpenseChannel | null
  readonly settlementNote: string | null
  readonly slot: 1 | 2
  readonly status: ExpenseOccurrenceStatus
}

/** Linha da lista de vencimentos: a ocorrência com o que a tela precisa da conta. */
export type ExpenseOccurrenceListItem = ExpenseOccurrence & {
  readonly categoryId: string
  readonly categoryName: string
  readonly expenseKind: ExpenseKind
  readonly expenseName: string
  readonly installmentsTotal: number | null
  readonly payeeName: string | null
  readonly supplier: string | null
}

export type ExpenseAmountChange = {
  readonly changedBy: string
  readonly createdAt: string
  /** `yyyy-mm`: a primeira competência com o valor novo. */
  readonly effectiveCompetence: string
  readonly expenseId: string
  readonly id: string
  readonly kind: ExpenseAmountChangeKind
  readonly newAmount: string
  readonly previousAmount: string
}

/** Situação de uma ocorrência aberta num dia: a vencer, vence hoje ou vencida. */
export type ExpenseDueState = 'upcoming' | 'due_today' | 'overdue'

/** Categorias semeadas para empresa nova. Genéricas: servem a restaurante, transportadora ou escritório. */
export const DEFAULT_EXPENSE_CATEGORIES: readonly {
  readonly costGroup: ExpenseCostGroup
  readonly name: string
}[] = [
  { costGroup: 'administrative', name: 'Aluguel' },
  { costGroup: 'administrative', name: 'Energia' },
  { costGroup: 'administrative', name: 'Água' },
  { costGroup: 'administrative', name: 'Internet e telefone' },
  { costGroup: 'administrative', name: 'Salários e encargos' },
  { costGroup: 'administrative', name: 'Impostos e taxas' },
  { costGroup: 'administrative', name: 'Fornecedores' },
  { costGroup: 'administrative', name: 'Manutenção' },
  { costGroup: 'administrative', name: 'Marketing' },
  { costGroup: 'administrative', name: 'Cartão de crédito' },
  { costGroup: 'administrative', name: 'Empréstimos e financiamentos' },
  { costGroup: 'administrative', name: 'Outros' },
]
