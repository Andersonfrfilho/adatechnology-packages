/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O formulário guarda TEXTO (é o que o input devolve); a conversão para o corpo da API mora aqui,
 * pura, para ter teste sem navegador.
 */

import type {
  CampaignInput,
  CreateItemInput,
  FieldDefinition,
  ItemStatus,
  KindDefinition,
  RecommendationItem,
  RecommendationSource,
  UpdateItemInput,
} from '../providers/types'

export type ItemDraft = {
  kind: string
  source: RecommendationSource
  status: ItemStatus
  title: string
  summary: string
  imageUrl: string
  linkUrl: string
  city: string
  state: string
  minAge: string
  maxAge: string
  tags: string
  sponsorId: string
  attributes: Record<string, string | boolean>
}

export type DraftError = { readonly field: string; readonly message: string }

export function emptyDraft(kind: KindDefinition | undefined): ItemDraft {
  return {
    kind: kind?.name ?? '',
    source: 'curated',
    status: 'draft',
    title: '',
    summary: '',
    imageUrl: '',
    linkUrl: '',
    city: '',
    state: '',
    minAge: '',
    maxAge: '',
    tags: '',
    sponsorId: '',
    attributes: {},
  }
}

export function draftFromItem(item: RecommendationItem): ItemDraft {
  const attributes: Record<string, string | boolean> = {}
  for (const [name, value] of Object.entries(item.attributes)) {
    attributes[name] = typeof value === 'boolean' ? value : String(value)
  }
  return {
    kind: item.kind,
    source: item.source,
    status: item.status,
    title: item.title,
    summary: item.summary ?? '',
    imageUrl: item.imageUrl ?? '',
    linkUrl: item.linkUrl ?? '',
    city: item.city ?? '',
    state: item.state ?? '',
    minAge: item.minAge === null ? '' : String(item.minAge),
    maxAge: item.maxAge === null ? '' : String(item.maxAge),
    tags: item.tags.join(', '),
    sponsorId: item.sponsorId ?? '',
    attributes,
  }
}

export function parseTags(text: string): string[] {
  const tags = text
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0)
  return [...new Set(tags)]
}

const isHttpUrl = (value: string) => /^https?:\/\/\S+$/i.test(value)
const nullable = (value: string) => (value.trim() === '' ? null : value.trim())

function parseAge(value: string, field: string, errors: DraftError[]): number | null {
  if (value.trim() === '') return null
  const age = Number(value)
  if (!Number.isInteger(age) || age < 0 || age > 120) {
    errors.push({ field, message: 'Use um número inteiro de 0 a 120' })
    return null
  }
  return age
}

function parseAttribute(field: FieldDefinition, value: string | boolean | undefined, errors: DraftError[]): unknown {
  if (field.type === 'boolean') return value === true ? true : value === false ? false : undefined
  const text = typeof value === 'string' ? value.trim() : ''
  if (text === '') {
    if (field.required) errors.push({ field: `attributes.${field.name}`, message: 'Obrigatório' })
    return null
  }
  if (field.type === 'number') {
    const parsed = Number(text.replace(',', '.'))
    if (!Number.isFinite(parsed)) errors.push({ field: `attributes.${field.name}`, message: 'Use um número' })
    return parsed
  }
  if (field.type === 'url' && !isHttpUrl(text)) {
    errors.push({ field: `attributes.${field.name}`, message: 'Use um endereço http ou https' })
  }
  return text
}

/**
 * Valida e monta o corpo. Os mesmos limites do servidor, para o erro aparecer no campo e não como
 * resposta 400 genérica — mas o servidor continua sendo quem decide.
 */
export function buildItemPayload(params: { readonly draft: ItemDraft; readonly kind: KindDefinition | undefined }): {
  payload: CreateItemInput
  errors: DraftError[]
} {
  const { draft, kind } = params
  const errors: DraftError[] = []

  if (!kind) errors.push({ field: 'kind', message: 'Escolha o tipo' })
  if (draft.title.trim() === '') errors.push({ field: 'title', message: 'Obrigatório' })
  if (draft.title.length > 160) errors.push({ field: 'title', message: 'Até 160 caracteres' })
  if (draft.summary.length > 500) errors.push({ field: 'summary', message: 'Até 500 caracteres' })
  for (const field of ['imageUrl', 'linkUrl'] as const) {
    const value = draft[field].trim()
    if (value !== '' && !isHttpUrl(value)) errors.push({ field, message: 'Use um endereço http ou https' })
  }
  if (draft.state.trim() !== '' && draft.state.trim().length !== 2)
    errors.push({ field: 'state', message: 'Use a sigla com 2 letras' })
  if (draft.source === 'sponsored' && draft.sponsorId.trim() === '') {
    errors.push({ field: 'sponsorId', message: 'Recomendação patrocinada precisa de anunciante' })
  }

  const minAge = parseAge(draft.minAge, 'minAge', errors)
  const maxAge = parseAge(draft.maxAge, 'maxAge', errors)
  if (minAge !== null && maxAge !== null && minAge > maxAge) {
    errors.push({ field: 'minAge', message: 'A mínima não pode passar da máxima' })
  }

  const attributes: Record<string, unknown> = {}
  for (const field of kind?.fields ?? []) {
    const value = parseAttribute(field, draft.attributes[field.name], errors)
    if (value !== undefined) attributes[field.name] = value
  }

  return {
    errors,
    payload: {
      kind: draft.kind,
      source: draft.source,
      status: draft.status,
      title: draft.title.trim(),
      summary: nullable(draft.summary),
      imageUrl: nullable(draft.imageUrl),
      linkUrl: nullable(draft.linkUrl),
      city: nullable(draft.city),
      state: draft.state.trim() === '' ? null : draft.state.trim().toUpperCase(),
      minAge,
      maxAge,
      tags: parseTags(draft.tags),
      attributes,
      sponsorId: draft.source === 'sponsored' ? nullable(draft.sponsorId) : null,
    },
  }
}

/** Na edição, `kind` e `source` não vão: o servidor não deixa mudar. */
export function toUpdatePayload(payload: CreateItemInput): UpdateItemInput {
  const { kind, source, ...rest } = payload
  void kind
  void source
  return rest
}

export type CampaignDraft = {
  plan: string
  priority: string
  startsAt: string
  endsAt: string
  placements: string[]
}

/** `datetime-local` vem sem fuso; vira ISO no fuso do navegador de quem está cadastrando. */
export function buildCampaignPayload(draft: CampaignDraft): { payload: CampaignInput; errors: DraftError[] } {
  const errors: DraftError[] = []
  if (!draft.plan) errors.push({ field: 'plan', message: 'Escolha o plano' })
  const startsAt = new Date(draft.startsAt)
  if (Number.isNaN(startsAt.getTime())) errors.push({ field: 'startsAt', message: 'Data inválida' })
  const endsAt = draft.endsAt ? new Date(draft.endsAt) : null
  if (endsAt && Number.isNaN(endsAt.getTime())) errors.push({ field: 'endsAt', message: 'Data inválida' })
  if (endsAt && !Number.isNaN(startsAt.getTime()) && endsAt <= startsAt) {
    errors.push({ field: 'endsAt', message: 'O fim precisa ser depois do início' })
  }
  const priority = draft.priority.trim() === '' ? 0 : Number(draft.priority)
  if (!Number.isInteger(priority) || priority < 0 || priority > 1000) {
    errors.push({ field: 'priority', message: 'Use um número inteiro de 0 a 1000' })
  }

  return {
    errors,
    payload: {
      plan: draft.plan,
      priority: Number.isInteger(priority) ? priority : 0,
      startsAt: Number.isNaN(startsAt.getTime()) ? draft.startsAt : startsAt.toISOString(),
      endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt.toISOString() : null,
      placements: draft.placements,
    },
  }
}

export function clickRate(impressions: number, clicks: number): string {
  if (impressions === 0) return '-'
  return `${((clicks / impressions) * 100).toFixed(1).replace('.', ',')}%`
}

/** `AAAA-MM-DD` de hoje e de 29 dias atrás, no fuso do navegador. */
export function last30Days(now: Date = new Date()): { from: string; to: string } {
  const format = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const from = new Date(now)
  from.setDate(from.getDate() - 29)
  return { from: format(from), to: format(now) }
}
