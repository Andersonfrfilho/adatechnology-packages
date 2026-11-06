/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Validação na fronteira. As regras que dependem do estado (o tipo existe? o plano existe?) ficam
 * nos casos de uso, que conhecem a configuração; aqui fica só a FORMA.
 */

import { z } from 'zod'

import { CAMPAIGN_STATUS, ITEM_STATUS, RECOMMENDATION_EVENT, RECOMMENDATION_SOURCE } from './recommendation.types'
import { FIELD_TYPE, MAX_FEED_LIMIT, NAME_PATTERN } from './config.types'

const nameSchema = z.string().regex(NAME_PATTERN, 'Use minúsculas, números, "_" ou "-", começando por letra')

/**
 * Só `http:` e `https:`. O link vai para um `href` na tela do usuário final, e `javascript:` num
 * anúncio é execução de script na sessão de quem clicou.
 */
export const httpUrlSchema = z
  .string()
  .max(2048)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), { message: 'Use um endereço http ou https' })

export const fieldDefinitionSchema = z
  .object({
    name: nameSchema,
    label: z.string().min(1).max(80),
    type: z.nativeEnum(FIELD_TYPE),
    required: z.boolean(),
    options: z
      .array(z.object({ value: z.string().min(1).max(80), label: z.string().min(1).max(80) }))
      .max(100)
      .optional(),
  })
  .refine((field) => field.type !== FIELD_TYPE.SELECT || (field.options?.length ?? 0) > 0, {
    message: 'Campo do tipo `select` precisa de ao menos uma opção',
    path: ['options'],
  })

function uniqueNames(list: readonly { readonly name: string }[]): boolean {
  return new Set(list.map((entry) => entry.name)).size === list.length
}

export const kindDefinitionSchema = z.object({
  name: nameSchema,
  label: z.string().min(1).max(80),
  fields: z.array(fieldDefinitionSchema).max(40).refine(uniqueNames, { message: 'Campos com nome repetido' }),
})

export const planDefinitionSchema = z.object({
  name: nameSchema,
  label: z.string().min(1).max(80),
  weight: z.number().int().min(0).max(1000),
})

export const placementDefinitionSchema = z.object({
  name: nameSchema,
  label: z.string().min(1).max(80),
  maxSponsored: z.number().int().min(0).max(MAX_FEED_LIMIT).optional(),
})

/** Conferido no BOOT: configuração inválida derruba a subida, não a primeira requisição. */
export const recommendationModuleConfigSchema = z.object({
  tenancy: z.union([z.object({ mode: z.literal('single') }), z.object({ mode: z.literal('multi') })]),
  kinds: z.array(kindDefinitionSchema).min(1).refine(uniqueNames, { message: 'Tipos com nome repetido' }),
  plans: z.array(planDefinitionSchema).min(1).refine(uniqueNames, { message: 'Planos com nome repetido' }),
  placements: z.array(placementDefinitionSchema).min(1).refine(uniqueNames, { message: 'Espaços com nome repetido' }),
  maxSponsoredPerFeed: z.number().int().min(0).max(MAX_FEED_LIMIT).optional(),
  defaultFeedLimit: z.number().int().min(1).max(MAX_FEED_LIMIT).optional(),
  timeZone: z
    .string()
    .refine(
      (zone) => {
        try {
          new Intl.DateTimeFormat('en-CA', { timeZone: zone })
          return true
        } catch {
          return false
        }
      },
      { message: 'Fuso horário desconhecido' },
    )
    .optional(),
})

const ageSchema = z.number().int().min(0).max(120)
const tagSchema = z.string().trim().toLowerCase().min(1).max(40)

const itemFieldsSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(500).nullable().optional(),
  imageUrl: httpUrlSchema.nullable().optional(),
  linkUrl: httpUrlSchema.nullable().optional(),
  city: z.string().trim().min(1).max(120).nullable().optional(),
  state: z.string().trim().length(2).toUpperCase().nullable().optional(),
  minAge: ageSchema.nullable().optional(),
  maxAge: ageSchema.nullable().optional(),
  tags: z.array(tagSchema).max(20).optional(),
  attributes: z.record(z.unknown()).optional(),
  sponsorId: z.string().uuid().nullable().optional(),
  status: z.nativeEnum(ITEM_STATUS).optional(),
})

function agesInOrder(value: { minAge?: number | null; maxAge?: number | null }): boolean {
  return value.minAge == null || value.maxAge == null || value.minAge <= value.maxAge
}

const AGE_ORDER = { message: 'A idade mínima não pode passar da máxima', path: ['minAge'] }

export const createItemSchema = itemFieldsSchema
  .extend({
    kind: nameSchema,
    source: z.nativeEnum(RECOMMENDATION_SOURCE),
  })
  .refine(agesInOrder, AGE_ORDER)

export type CreateItemInput = z.infer<typeof createItemSchema>

/** `kind` e `source` não mudam: os atributos gravados são do tipo, e a origem decide a cobrança. */
export const updateItemSchema = itemFieldsSchema.partial().refine(agesInOrder, AGE_ORDER)

export type UpdateItemInput = z.infer<typeof updateItemSchema>

const intFromQuery = (min: number, max: number) => z.coerce.number().int().min(min).max(max)

export const listItemsSchema = z.object({
  page: intFromQuery(1, 10_000).default(1),
  perPage: intFromQuery(1, 100).default(20),
  kind: nameSchema.optional(),
  source: z.nativeEnum(RECOMMENDATION_SOURCE).optional(),
  status: z.nativeEnum(ITEM_STATUS).optional(),
  sponsorId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(120).optional(),
})

export type ListItemsQuery = z.infer<typeof listItemsSchema>

const dateSchema = z.coerce.date()

export const createCampaignSchema = z
  .object({
    plan: nameSchema,
    priority: z.number().int().min(0).max(1000).default(0),
    startsAt: dateSchema,
    endsAt: dateSchema.nullable().optional(),
    placements: z.array(nameSchema).max(20).default([]),
    externalReference: z.string().trim().min(1).max(200).nullable().optional(),
    status: z.nativeEnum(CAMPAIGN_STATUS).optional(),
  })
  .refine((value) => value.endsAt == null || value.endsAt > value.startsAt, {
    message: 'O fim precisa ser depois do início',
    path: ['endsAt'],
  })

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>

export const updateCampaignSchema = z.object({
  plan: nameSchema.optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  startsAt: dateSchema.optional(),
  endsAt: dateSchema.nullable().optional(),
  placements: z.array(nameSchema).max(20).optional(),
  externalReference: z.string().trim().min(1).max(200).nullable().optional(),
  status: z.nativeEnum(CAMPAIGN_STATUS).optional(),
})

export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>

const tagsFromQuery = z
  .string()
  .max(400)
  .transform((value) =>
    value
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0)
      .slice(0, 20),
  )

/**
 * Contexto do feed. É o único "público-alvo" do trio, e é de propósito pouco: cidade, idade e
 * tags. Nada de histórico de navegação — perfil comportamental de família com criança é dado que
 * este pacote se recusa a ter (LGPD art. 14).
 */
export const feedQuerySchema = z.object({
  placement: nameSchema,
  kind: nameSchema.optional(),
  city: z.string().trim().min(1).max(120).optional(),
  age: intFromQuery(0, 120).optional(),
  tags: tagsFromQuery.optional(),
  limit: intFromQuery(1, MAX_FEED_LIMIT).optional(),
})

export type FeedQuery = z.infer<typeof feedQuerySchema>

export const trackEventSchema = z.object({
  itemId: z.string().uuid(),
  campaignId: z.string().uuid().nullable().optional(),
  placement: nameSchema,
  type: z.nativeEnum(RECOMMENDATION_EVENT),
})

export type TrackEventInput = z.infer<typeof trackEventSchema>

const dayFromQuery = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD')

export const statsQuerySchema = z
  .object({
    from: dayFromQuery,
    to: dayFromQuery,
    itemId: z.string().uuid().optional(),
    sponsorId: z.string().uuid().optional(),
  })
  .refine((value) => value.from <= value.to, { message: '`from` depois de `to`', path: ['from'] })

export type StatsQuery = z.infer<typeof statsQuerySchema>
