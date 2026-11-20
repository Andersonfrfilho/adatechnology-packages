/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * "Lançar conta" por conversa (WhatsApp, Telegram, bot): uma resposta por vez até o resumo com Confirmar/Corrigir/
 * Cancelar. Máquina de estados pura: o canal guarda `state` (JSON pequeno, sem dado pessoal além do nome digitado da
 * conta) entre as mensagens e chama `advanceExpenseConversation` com o texto ou o id do botão tocado. Só depois do
 * Confirmar sai `submit`, que o host grava pelo mesmo caso de uso do painel.
 */
import { formatBrl } from './money'
import { formatCivilDateBr } from './reminderText'
import type { ExpenseKind, ExpenseRecurrence } from './types'
import { normalizeChatText, parseExpenseAmount, parseExpenseDueDate, parseExpenseDueDay } from './whatsappInput'

export const EXPENSE_NAME_MIN_LENGTH = 2
export const EXPENSE_NAME_MAX_LENGTH = 80

export const EXPENSE_CONVERSATION_STEPS = [
  'kind',
  'name',
  'category',
  'amount',
  'recurrence',
  'due_day',
  'due_date',
  'confirm',
  'done',
  'cancelled',
] as const
export type ExpenseConversationStep = (typeof EXPENSE_CONVERSATION_STEPS)[number]

export const EXPENSE_CONVERSATION_ANSWER = {
  cancel: 'cancel',
  confirm: 'confirm',
  fix: 'fix',
} as const

export const EXPENSE_RECURRENCE_OPTIONS: readonly (readonly [ExpenseRecurrence, string])[] = [
  ['monthly', '📆 Mensal'],
  ['bimonthly', '📆 Bimestral'],
  ['quarterly', '📆 Trimestral'],
  ['yearly', '📆 Anual'],
]

export const EXPENSE_CONVERSATION_TEXT = {
  amount: 'Qual o valor? Por exemplo: 1500 ou 1.500,50',
  amountInvalid: 'Não entendi o valor. Digite só números, por exemplo: 1500 ou 1.500,50',
  cancelled: 'Certo, não lancei nada.',
  categoryChoice: 'Em qual categoria?',
  categoryInvalid: 'Escolha uma categoria da lista acima.',
  confirm: 'Confere a conta?',
  dueDate: 'Qual o vencimento? Por exemplo: 20/11, 20/11/2026, hoje ou amanhã.',
  dueDateInvalid: 'Não entendi a data. Use 20/11, 20/11/2026, hoje ou amanhã.',
  dueDay: 'Em que dia do mês ela vence? De 1 a 31.',
  dueDayInvalid: 'Digite o dia do mês, de 1 a 31.',
  kindChoice: 'Que tipo de conta você quer lançar?',
  kindInvalid: 'Escolha Fixa (todo mês) ou Variável (uma vez só).',
  name: 'Qual o nome da conta? Por exemplo: Aluguel do galpão.',
  nameInvalid: `O nome precisa ter de ${EXPENSE_NAME_MIN_LENGTH} a ${EXPENSE_NAME_MAX_LENGTH} letras. Digite de novo.`,
  noCategories: 'Não há categoria ativa para lançar. Cadastre uma em Contas, no painel.',
  recurrenceChoice: 'Com que frequência ela vence?',
  recurrenceInvalid: 'Escolha a frequência da lista acima.',
  saved: (name: string): string => `✅ Conta *${name}* lançada.`,
} as const

export type ExpenseConversationDraft = {
  readonly amount?: string
  readonly categoryId?: string
  readonly categoryName?: string
  readonly dueDate?: string
  readonly dueDay?: number
  readonly kind?: ExpenseKind
  readonly name?: string
  readonly recurrence?: ExpenseRecurrence
}

export type ExpenseConversationState = {
  readonly draft: ExpenseConversationDraft
  readonly step: ExpenseConversationStep
}

export type ExpenseConversationOption = { readonly id: string; readonly title: string }

/** O que o canal manda: texto e, quando há, botões/lista (o canal decide como desenhar). */
export type ExpenseConversationPrompt = {
  readonly options?: readonly ExpenseConversationOption[]
  readonly text: string
}

/** Pronto para o caso de uso de criar conta (o host acrescenta empresa, autor, canal e hoje). */
export type ExpenseConversationSubmit = {
  readonly categoryId: string
  readonly dueDate?: string
  readonly dueDay?: number
  readonly expectedAmount: string
  readonly kind: ExpenseKind
  readonly name: string
  readonly recurrence?: ExpenseRecurrence
}

export type ExpenseConversationResult = {
  readonly prompt: ExpenseConversationPrompt
  readonly state: ExpenseConversationState
  readonly submit?: ExpenseConversationSubmit
}

export type ExpenseConversationCategory = { readonly id: string; readonly name: string }

const KIND_OPTIONS: readonly ExpenseConversationOption[] = [
  { id: 'fixed', title: '🔁 Fixa' },
  { id: 'variable', title: '🧾 Variável' },
]

const CONFIRM_OPTIONS: readonly ExpenseConversationOption[] = [
  { id: EXPENSE_CONVERSATION_ANSWER.confirm, title: '✅ Confirmar' },
  { id: EXPENSE_CONVERSATION_ANSWER.fix, title: '✏️ Corrigir' },
  { id: EXPENSE_CONVERSATION_ANSWER.cancel, title: '❌ Cancelar' },
]

const CANCEL_WORDS = new Set(['cancelar', 'cancela', 'sair', 'parar', EXPENSE_CONVERSATION_ANSWER.cancel])

/** Começa a conversa: pergunta fixa ou variável. */
export function startExpenseConversation(): ExpenseConversationResult {
  return {
    prompt: { options: KIND_OPTIONS, text: EXPENSE_CONVERSATION_TEXT.kindChoice },
    state: { draft: {}, step: 'kind' },
  }
}

/** A resposta escolhe uma opção pelo id, pelo número da posição (1, 2…) ou pelo título sem emoji. */
export function matchConversationOption(
  input: string,
  options: readonly ExpenseConversationOption[],
): ExpenseConversationOption | undefined {
  const trimmed = input.trim()
  const byId = options.find((option) => option.id === trimmed)
  if (byId !== undefined) return byId
  if (/^\d{1,2}$/u.test(trimmed)) return options[Number(trimmed) - 1]
  const normalized = normalizeChatText(trimmed)
  if (normalized === '') return undefined
  return (
    options.find((option) => normalizeChatText(option.title) === normalized) ??
    options.find((option) => normalizeChatText(option.title).startsWith(normalized))
  )
}

function categoryOptions(categories: readonly ExpenseConversationCategory[]): ExpenseConversationOption[] {
  return categories.map((category) => ({ id: category.id, title: category.name }))
}

function recurrenceOptions(): ExpenseConversationOption[] {
  return EXPENSE_RECURRENCE_OPTIONS.map(([id, title]) => ({ id, title }))
}

const RECURRENCE_LABEL: Readonly<Record<ExpenseRecurrence, string>> = {
  bimonthly: 'bimestral',
  fortnightly: 'quinzenal',
  monthly: 'mensal',
  quarterly: 'trimestral',
  yearly: 'anual',
}

/** O resumo antes do Confirmar. */
export function describeExpenseDraft(draft: ExpenseConversationDraft): string {
  const lines = [
    `*${draft.name ?? ''}*`,
    `Categoria: ${draft.categoryName ?? '—'}`,
    `Valor: ${draft.amount === undefined ? '—' : formatBrl(draft.amount)}`,
  ]
  if (draft.kind === 'fixed') {
    lines.push(`Tipo: fixa, ${draft.recurrence === undefined ? '' : RECURRENCE_LABEL[draft.recurrence]}`.trim())
    lines.push(`Vence todo dia ${draft.dueDay ?? '—'}`)
  } else {
    lines.push('Tipo: variável (uma vez só)')
    lines.push(`Vencimento: ${draft.dueDate === undefined ? '—' : formatCivilDateBr(draft.dueDate)}`)
  }
  return lines.join('\n')
}

function ask(step: ExpenseConversationStep, draft: ExpenseConversationDraft, prompt: ExpenseConversationPrompt) {
  return { prompt, state: { draft, step } }
}

function askConfirm(draft: ExpenseConversationDraft): ExpenseConversationResult {
  return ask('confirm', draft, {
    options: CONFIRM_OPTIONS,
    text: `${EXPENSE_CONVERSATION_TEXT.confirm}\n\n${describeExpenseDraft(draft)}`,
  })
}

function askCategory(
  draft: ExpenseConversationDraft,
  categories: readonly ExpenseConversationCategory[],
  invalid = false,
): ExpenseConversationResult {
  if (categories.length === 0) {
    return { prompt: { text: EXPENSE_CONVERSATION_TEXT.noCategories }, state: { draft, step: 'cancelled' } }
  }
  return ask('category', draft, {
    options: categoryOptions(categories),
    text: invalid ? EXPENSE_CONVERSATION_TEXT.categoryInvalid : EXPENSE_CONVERSATION_TEXT.categoryChoice,
  })
}

/**
 * Avança um passo. `input` é o texto digitado ou o id do botão. `categories` são as ativas que podem ser oferecidas
 * (o host já tirou as que exigem dado que o chat não colhe). `today` é o dia civil da empresa.
 */
export function advanceExpenseConversation(params: {
  readonly categories: readonly ExpenseConversationCategory[]
  readonly input: string
  readonly state: ExpenseConversationState
  readonly today: string
}): ExpenseConversationResult {
  const { categories, input, state, today } = params
  const draft = state.draft
  const normalized = normalizeChatText(input)

  if (CANCEL_WORDS.has(normalized) || input.trim() === EXPENSE_CONVERSATION_ANSWER.cancel) {
    return { prompt: { text: EXPENSE_CONVERSATION_TEXT.cancelled }, state: { draft: {}, step: 'cancelled' } }
  }

  switch (state.step) {
    case 'done':
    case 'cancelled':
      return startExpenseConversation()

    case 'kind': {
      const choice = matchConversationOption(input, KIND_OPTIONS)
      const kind: ExpenseKind | undefined =
        choice?.id === 'fixed' || /\b(fixa|fixo|mensal|todo mes)\b/u.test(normalized)
          ? 'fixed'
          : choice?.id === 'variable' || /\b(variavel|avulsa|uma vez)\b/u.test(normalized)
            ? 'variable'
            : undefined
      if (kind === undefined) {
        return ask('kind', draft, { options: KIND_OPTIONS, text: EXPENSE_CONVERSATION_TEXT.kindInvalid })
      }
      return ask('name', { kind }, { text: EXPENSE_CONVERSATION_TEXT.name })
    }

    case 'name': {
      const name = input.trim().replace(/\s+/gu, ' ')
      if (name.length < EXPENSE_NAME_MIN_LENGTH || name.length > EXPENSE_NAME_MAX_LENGTH) {
        return ask('name', draft, { text: EXPENSE_CONVERSATION_TEXT.nameInvalid })
      }
      return askCategory({ ...draft, name }, categories)
    }

    case 'category': {
      const choice = matchConversationOption(input, categoryOptions(categories))
      if (choice === undefined) return askCategory(draft, categories, true)
      return ask(
        'amount',
        { ...draft, categoryId: choice.id, categoryName: choice.title },
        { text: EXPENSE_CONVERSATION_TEXT.amount },
      )
    }

    case 'amount': {
      const amount = parseExpenseAmount(input)
      if (amount === undefined) return ask('amount', draft, { text: EXPENSE_CONVERSATION_TEXT.amountInvalid })
      const next = { ...draft, amount }
      return draft.kind === 'fixed'
        ? ask('recurrence', next, { options: recurrenceOptions(), text: EXPENSE_CONVERSATION_TEXT.recurrenceChoice })
        : ask('due_date', next, { text: EXPENSE_CONVERSATION_TEXT.dueDate })
    }

    case 'recurrence': {
      const choice = matchConversationOption(input, recurrenceOptions())
      if (choice === undefined) {
        return ask('recurrence', draft, {
          options: recurrenceOptions(),
          text: EXPENSE_CONVERSATION_TEXT.recurrenceInvalid,
        })
      }
      return ask(
        'due_day',
        { ...draft, recurrence: choice.id as ExpenseRecurrence },
        { text: EXPENSE_CONVERSATION_TEXT.dueDay },
      )
    }

    case 'due_day': {
      const dueDay = parseExpenseDueDay(input)
      if (dueDay === undefined) return ask('due_day', draft, { text: EXPENSE_CONVERSATION_TEXT.dueDayInvalid })
      return askConfirm({ ...draft, dueDay })
    }

    case 'due_date': {
      const dueDate = parseExpenseDueDate(input, today)
      if (dueDate === undefined) return ask('due_date', draft, { text: EXPENSE_CONVERSATION_TEXT.dueDateInvalid })
      return askConfirm({ ...draft, dueDate })
    }

    case 'confirm': {
      const choice = matchConversationOption(input, CONFIRM_OPTIONS)
      const answer = choice?.id ?? (/\b(sim|ok|isso|confirmo|confirmar)\b/u.test(normalized) ? 'confirm' : undefined)
      if (answer === EXPENSE_CONVERSATION_ANSWER.fix) return startExpenseConversation()
      if (answer !== EXPENSE_CONVERSATION_ANSWER.confirm) return askConfirm(draft)
      const submit = toSubmit(draft)
      if (submit === null) return startExpenseConversation()
      return {
        prompt: { text: EXPENSE_CONVERSATION_TEXT.saved(submit.name) },
        state: { draft: {}, step: 'done' },
        submit,
      }
    }
  }
}

function toSubmit(draft: ExpenseConversationDraft): ExpenseConversationSubmit | null {
  if (
    draft.kind === undefined ||
    draft.name === undefined ||
    draft.categoryId === undefined ||
    draft.amount === undefined
  ) {
    return null
  }
  if (draft.kind === 'fixed') {
    if (draft.recurrence === undefined || draft.dueDay === undefined) return null
    return {
      categoryId: draft.categoryId,
      dueDay: draft.dueDay,
      expectedAmount: draft.amount,
      kind: 'fixed',
      name: draft.name,
      recurrence: draft.recurrence,
    }
  }
  if (draft.dueDate === undefined) return null
  return {
    categoryId: draft.categoryId,
    dueDate: draft.dueDate,
    expectedAmount: draft.amount,
    kind: 'variable',
    name: draft.name,
  }
}
