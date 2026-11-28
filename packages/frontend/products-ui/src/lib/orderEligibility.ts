import type { Product, ProductOrderEligibility, OrderAudience } from '../providers/types'
import { ORDER_AUDIENCE } from '../providers/types'

export const ORDER_ELIGIBILITY_KEY = 'orderEligibility'
export const MAX_ORDER_AGE = 21
export const QUICK_MINIMUM_AGE = 18

export type OrderEligibilityLabels = {
  readonly section: string
  readonly minimumAge: string
  readonly minimumAgePlaceholder: string
  readonly minimumAgeHint: string
  readonly quickAgeChip: string
  readonly audience: string
  readonly everyone: string
  readonly stayingGuests: string
  readonly invalidAge: string
}

export const DEFAULT_ORDER_ELIGIBILITY_LABELS: OrderEligibilityLabels = {
  section: 'Quem pode pedir',
  minimumAge: 'Idade mínima para pedir',
  minimumAgePlaceholder: 'Sem restrição',
  minimumAgeHint: 'Deixe em branco para não restringir por idade.',
  quickAgeChip: '18',
  audience: 'Quem pode pedir',
  everyone: 'Todos',
  stayingGuests: 'Só hóspedes com estadia ativa',
  invalidAge: `Informe uma idade inteira de 0 a ${MAX_ORDER_AGE}`,
}

export type OrderEligibilityDraft = {
  readonly minimumAge: string
  readonly audience: OrderAudience
}

export function toOrderEligibilityDraft(attributes: Product['attributes']): OrderEligibilityDraft {
  const stored = attributes?.[ORDER_ELIGIBILITY_KEY] as ProductOrderEligibility | null | undefined
  const age = stored?.minimumAge
  return {
    minimumAge: typeof age === 'number' ? String(age) : '',
    audience:
      stored?.audience === ORDER_AUDIENCE.STAYING_GUESTS ? ORDER_AUDIENCE.STAYING_GUESTS : ORDER_AUDIENCE.EVERYONE,
  }
}

export function validateOrderEligibility(draft: OrderEligibilityDraft): boolean {
  if (draft.minimumAge === '') return true
  const age = Number(draft.minimumAge)
  return Number.isInteger(age) && age >= 0 && age <= MAX_ORDER_AGE
}

// Sem restrição nenhuma devolve `undefined`: a chave sai de `attributes` em vez de guardar um
// objeto vazio, e produtos antigos continuam com o formato de sempre.
export function buildOrderEligibility(draft: OrderEligibilityDraft): ProductOrderEligibility | undefined {
  const hasAge = draft.minimumAge !== ''
  const isRestrictedAudience = draft.audience !== ORDER_AUDIENCE.EVERYONE
  if (!hasAge && !isRestrictedAudience) return undefined
  return {
    ...(hasAge ? { minimumAge: Number(draft.minimumAge) } : {}),
    ...(isRestrictedAudience ? { audience: draft.audience } : {}),
  }
}

export function withoutOrderEligibility(attributes: Product['attributes']): Record<string, unknown> {
  return Object.fromEntries(Object.entries(attributes ?? {}).filter(([key]) => key !== ORDER_ELIGIBILITY_KEY))
}
