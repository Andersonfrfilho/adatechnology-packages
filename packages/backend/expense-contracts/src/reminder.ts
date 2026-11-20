/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A regra de **quando** avisar, **quem** avisar e **por qual canal**, pura (sem banco, sem relógio, sem fuso: datas
 * civis em texto e a hora já convertida). A rotina do host só a aplica.
 *
 * - **Quando**: `before` exatamente `daysBefore` dias antes (0 desliga), `due_today` no dia e `overdue` do 1º ao
 *   `maxOverdueNotices`-ésimo dia de atraso, contado pelo calendário (rotina que não rodou num dia não empurra o aviso).
 *   Nada antes de `dailySummaryHour`.
 * - **Quem**: o responsável, se ainda é da empresa **e** tem algum canal ligado; senão os administradores. Responsável
 *   que não pode receber nada conta como sem responsável: o aviso cai no administrador em vez de não sair.
 * - **Canal**: e-mail sempre que a pessoa tem e-mail; WhatsApp só com opt-in **e** número verificado; push só com
 *   opt-in. Cada um ainda precisa estar ligado na empresa. A ordem é fixa (e-mail, WhatsApp, push).
 */

export const REMINDER_KINDS = ['before', 'due_today', 'overdue'] as const
export type ReminderKind = (typeof REMINDER_KINDS)[number]
export const REMINDER_CHANNELS = ['email', 'whatsapp', 'push'] as const
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number]

export type ReminderSettings = {
  /** Avisa N dias antes (padrão 3; 0 desliga o aviso antecipado). */
  readonly daysBefore: number
  /** Avisos de atraso, um por dia, até este limite (padrão 3). */
  readonly maxOverdueNotices: number
  /** Canais ligados na empresa; só neles o aviso sai. */
  readonly enabledChannels: readonly ReminderChannel[]
  /** Resumo diário ligado (padrão desligado). */
  readonly dailySummaryEnabled: boolean
  /** Hora cheia (0–23) a partir da qual saem o resumo e os avisos do dia (padrão 8). */
  readonly dailySummaryHour: number
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  dailySummaryEnabled: false,
  dailySummaryHour: 8,
  daysBefore: 3,
  enabledChannels: ['email'],
  maxOverdueNotices: 3,
}

export type ReminderRecipient = {
  readonly channels: readonly ReminderChannel[]
  readonly userId: string
}

const DAY_MS = 86_400_000
const CIVIL_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/u
const CHANNEL_ORDER: readonly ReminderChannel[] = ['email', 'whatsapp', 'push']

function civilDayNumber(value: string): number {
  const match = CIVIL_DATE_REGEX.exec(value)
  if (match === null) throw new Error(`data civil inválida: ${value}`)
  const [, year, month, day] = match
  return Date.UTC(Number(year), Number(month) - 1, Number(day)) / DAY_MS
}

/** Dias de `from` até `to` (positivo quando `to` é depois). Datas `yyyy-mm-dd`. */
export function civilDaysBetween(from: string, to: string): number {
  return civilDayNumber(to) - civilDayNumber(from)
}

/** O tipo de aviso que a ocorrência aberta pede hoje, ou `null`. Não olha status: isso é do caso de uso. */
export function reminderKindOn(input: {
  readonly dueDate: string
  readonly settings: Pick<ReminderSettings, 'daysBefore' | 'maxOverdueNotices'>
  readonly today: string
}): ReminderKind | null {
  const daysUntil = civilDaysBetween(input.today, input.dueDate)
  if (daysUntil === 0) return 'due_today'
  if (daysUntil > 0) {
    return input.settings.daysBefore > 0 && daysUntil === input.settings.daysBefore ? 'before' : null
  }
  return -daysUntil <= input.settings.maxOverdueNotices ? 'overdue' : null
}

/** Quantos dias faltam (positivo) ou de atraso (negativo). */
export function daysUntilDue(input: { readonly dueDate: string; readonly today: string }): number {
  return civilDaysBetween(input.today, input.dueDate)
}

/** O resumo do dia lista o que vence hoje e tudo o que está vencido e aberto, sem limite de dias. */
export function belongsToDailySummary(input: {
  readonly dueDate: string
  readonly status: string
  readonly today: string
}): boolean {
  return input.status === 'open' && civilDaysBetween(input.today, input.dueDate) <= 0
}

/** Avisos e resumo só saem a partir da hora configurada (hora cheia 0–23 no fuso da empresa). */
export function isReminderHour(input: {
  readonly hourOfDay: number
  readonly settings: Pick<ReminderSettings, 'dailySummaryHour'>
}): boolean {
  return input.hourOfDay >= input.settings.dailySummaryHour
}

/** O que a pessoa tem para receber, antes de olhar a empresa. */
export type ReminderPersonFacts = {
  readonly hasEmail: boolean
  readonly hasVerifiedWhatsapp: boolean
  readonly pushOptIn: boolean
  readonly whatsappOptIn: boolean
}

/**
 * Quem é só equipe de campo (motorista, entregador, cozinha) não recebe aviso de conta, a menos que também tenha papel
 * de escritório. `fieldRoles` são os papéis de campo do produto; `neutralRoles` os que todo mundo tem (não contam como
 * escritório). `isFieldStaff` cobre o cadastro de campo fora do papel (ficha de motorista, por exemplo).
 */
export function isBarredFromReminders(facts: {
  readonly fieldRoles: readonly string[]
  readonly isFieldStaff?: boolean
  readonly neutralRoles?: readonly string[]
  readonly roles: readonly string[]
}): boolean {
  const neutral = facts.neutralRoles ?? []
  const isField = facts.isFieldStaff === true || facts.roles.some((role) => facts.fieldRoles.includes(role))
  const hasOfficeRole = facts.roles.some((role) => !facts.fieldRoles.includes(role) && !neutral.includes(role))
  return isField && !hasOfficeRole
}

/** Os canais da pessoa (sem a empresa). E-mail não tem opt-out: é o canal que garante o aviso. */
export function personalReminderChannels(facts: ReminderPersonFacts): readonly ReminderChannel[] {
  return CHANNEL_ORDER.filter((channel) => {
    if (channel === 'email') return facts.hasEmail
    if (channel === 'whatsapp') return facts.whatsappOptIn && facts.hasVerifiedWhatsapp
    return facts.pushOptIn
  })
}

/** Os canais em que o aviso de fato sai para a pessoa: os dela, ligados na empresa. */
export function effectiveReminderChannels(input: {
  readonly companyChannels: readonly ReminderChannel[]
  readonly recipient: Pick<ReminderRecipient, 'channels'>
}): readonly ReminderChannel[] {
  return CHANNEL_ORDER.filter(
    (channel) => input.recipient.channels.includes(channel) && input.companyChannels.includes(channel),
  )
}

export type ReminderRecipientReason = 'responsible' | 'no_responsible' | 'responsible_unreachable'

export type ReminderRecipientChoice = {
  readonly reason: ReminderRecipientReason
  /** Já com os canais efetivos; vazio só quando nem administrador pode receber. */
  readonly recipients: readonly ReminderRecipient[]
}

/** Quem recebe o aviso de uma ocorrência. `responsible` é `null` quando a conta não tem ou ele saiu da empresa. */
export function chooseReminderRecipients(input: {
  readonly admins: readonly ReminderRecipient[]
  readonly companyChannels: readonly ReminderChannel[]
  readonly responsible: ReminderRecipient | null
}): ReminderRecipientChoice {
  const reachable = (recipient: ReminderRecipient): ReminderRecipient | null => {
    const channels = effectiveReminderChannels({ companyChannels: input.companyChannels, recipient })
    return channels.length === 0 ? null : { channels, userId: recipient.userId }
  }

  if (input.responsible !== null) {
    const responsible = reachable(input.responsible)
    if (responsible !== null) return { reason: 'responsible', recipients: [responsible] }
  }

  const seen = new Set<string>()
  const admins = input.admins
    .map(reachable)
    .filter((recipient): recipient is ReminderRecipient => recipient !== null)
    .filter((recipient) => (seen.has(recipient.userId) ? false : (seen.add(recipient.userId), true)))
  return {
    reason: input.responsible === null ? 'no_responsible' : 'responsible_unreachable',
    recipients: admins,
  }
}
