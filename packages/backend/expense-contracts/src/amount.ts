/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Cada mudança de valor de uma conta é uma linha nova (histórico só cresce). O valor de uma competência é o da última
 * mudança com início até ela; sem nenhuma, o valor de abertura.
 */
import { normalizeMoney } from './money'
import { competenceOfDate } from './schedule'
import type { ExpenseAmountChangeKind } from './types'

export type AmountChangeLike = {
  readonly createdAt?: string
  readonly effectiveCompetence: string
  readonly newAmount: string
}

function byStartThenCreation(left: AmountChangeLike, right: AmountChangeLike): number {
  if (left.effectiveCompetence !== right.effectiveCompetence) {
    return left.effectiveCompetence < right.effectiveCompetence ? -1 : 1
  }
  const leftCreated = left.createdAt ?? ''
  const rightCreated = right.createdAt ?? ''
  if (leftCreated === rightCreated) return 0
  return leftCreated < rightCreated ? -1 : 1
}

/** Valor em vigor numa competência: o da última mudança com início até ela; sem nenhuma, `baseAmount`. */
export function amountInEffect(baseAmount: string, changes: readonly AmountChangeLike[], competence: string): string {
  let amount = baseAmount
  for (const change of [...changes].sort(byStartThenCreation)) {
    if (change.effectiveCompetence <= competence) amount = change.newAmount
  }
  return amount
}

export type PlannedAmountChange = {
  /** `yyyy-mm`: início da vigência do valor novo. */
  readonly effectiveCompetence: string
  readonly kind: ExpenseAmountChangeKind
  readonly newAmount: string
  /** `adjustment` só regrava ocorrência aberta que ainda não venceu; `correction` regrava as abertas do trecho. */
  readonly onlyNotDue: boolean
  readonly previousAmount: string
  /** Até onde a correção vale (exclusivo); nulo = sem fim. */
  readonly untilCompetence: string | null
}

/**
 * Decide a mudança de valor pedida. Devolve `null` quando o valor não muda (nada a gravar).
 * - reajuste (`adjustment`): vale de `effectiveFrom` (padrão: o mês de `today`) em diante;
 * - correção (`correction`): troca o trecho de valor em que `correctionCompetence` está, do começo dele até a próxima
 *   mudança.
 */
export function planAmountChange(input: {
  readonly baseAmount: string
  readonly changes: readonly AmountChangeLike[]
  readonly correctionCompetence?: string
  readonly effectiveFrom?: string
  readonly kind?: ExpenseAmountChangeKind
  readonly newAmount: string
  readonly today: string
}): PlannedAmountChange | null {
  const newAmount = normalizeMoney(input.newAmount)
  if (newAmount === null) throw new RangeError(`valor inválido: ${input.newAmount}`)
  if (input.kind === 'correction') {
    const competence = input.correctionCompetence
    if (competence === undefined || !/^\d{4}-(0[1-9]|1[0-2])$/u.test(competence)) {
      throw new RangeError('correctionCompetence precisa ser yyyy-mm')
    }
    const starts = input.changes.map((change) => change.effectiveCompetence)
    const segmentStart =
      starts
        .filter((start) => start <= competence)
        .sort()
        .at(-1) ?? '0000-01'
    const segmentEnd =
      starts
        .filter((start) => start > competence)
        .sort()
        .at(0) ?? null
    const previousAmount = amountInEffect(input.baseAmount, input.changes, competence)
    if (normalizeMoney(previousAmount) === newAmount) return null
    return {
      effectiveCompetence: segmentStart,
      kind: 'correction',
      newAmount,
      onlyNotDue: false,
      previousAmount,
      untilCompetence: segmentEnd,
    }
  }
  const effectiveCompetence = input.effectiveFrom ?? competenceOfDate(input.today)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(effectiveCompetence)) {
    throw new RangeError('effectiveFrom precisa ser yyyy-mm')
  }
  const previousAmount = amountInEffect(input.baseAmount, input.changes, effectiveCompetence)
  if (normalizeMoney(previousAmount) === newAmount) return null
  return {
    effectiveCompetence,
    kind: 'adjustment',
    newAmount,
    onlyNotDue: true,
    previousAmount,
    untilCompetence: null,
  }
}
