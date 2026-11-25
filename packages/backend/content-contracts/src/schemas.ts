/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Schemas de fronteira. `.strict()` em todo corpo: campo desconhecido é recusado, para que um
 * `status` ou `companyId` enviado no corpo nunca passe calado por cima da regra do use-case.
 */

import { z } from 'zod'

import { POST_STATUSES, type PostStatus } from './content.types'
import { isValidSlug, SLUG_MAX_LENGTH } from './slugify'
import { TAG_MAX_LENGTH, TAGS_MAX_COUNT } from './tags'

export const POST_LIMITS = {
  TITLE: 200,
  EXCERPT: 500,
  BODY: 100_000,
  URL: 2048,
  IMAGE_ALT: 300,
  AUTHOR_NAME: 120,
  SEO_TITLE: 200,
  SEO_DESCRIPTION: 320,
  SEARCH: 120,
  ADMIN_PAGE_SIZE: 100,
  PUBLIC_PAGE_SIZE: 50,
} as const

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(SLUG_MAX_LENGTH)
  .refine(isValidSlug, { message: 'Use letras minúsculas, números e hífen.' })

/** Só http(s): `javascript:` numa capa ou no canonical viraria `<a href>` ou `<link>` no site. */
export const httpUrlSchema = z
  .string()
  .trim()
  .max(POST_LIMITS.URL)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), { message: 'Use um endereço http(s).' })

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()

export const postFieldsSchema = z.object({
  title: z.string().trim().min(1).max(POST_LIMITS.TITLE),
  slug: slugSchema.optional(),
  excerpt: optionalText(POST_LIMITS.EXCERPT),
  body: z.string().max(POST_LIMITS.BODY).default(''),
  coverImageUrl: httpUrlSchema.nullable().optional(),
  coverImageAlt: optionalText(POST_LIMITS.IMAGE_ALT),
  tags: z.array(z.string().trim().min(1).max(TAG_MAX_LENGTH)).max(TAGS_MAX_COUNT).optional(),
  authorName: optionalText(POST_LIMITS.AUTHOR_NAME),
  seoTitle: optionalText(POST_LIMITS.SEO_TITLE),
  seoDescription: optionalText(POST_LIMITS.SEO_DESCRIPTION),
  canonicalUrl: httpUrlSchema.nullable().optional(),
})

export const createPostSchema = postFieldsSchema.strict()
export type CreatePostInput = z.input<typeof createPostSchema>

export const updatePostSchema = postFieldsSchema
  .extend({ body: z.string().max(POST_LIMITS.BODY) })
  .partial()
  .strict()
export type UpdatePostInput = z.input<typeof updatePostSchema>

/** Sem `publishedAt`, publica agora. Com data futura, agenda; com data passada, publica retroativo. */
export const publishPostSchema = z.object({ publishedAt: z.string().datetime({ offset: true }).optional() }).strict()
export type PublishPostInput = z.input<typeof publishPostSchema>

const pageSchema = z.coerce.number().int().min(1).max(10_000).default(1)

export const listPostsQuerySchema = z.object({
  page: pageSchema,
  pageSize: z.coerce.number().int().min(1).max(POST_LIMITS.ADMIN_PAGE_SIZE).default(20),
  status: z.enum(POST_STATUSES as [PostStatus, ...PostStatus[]]).optional(),
  tag: z.string().trim().min(1).max(TAG_MAX_LENGTH).optional(),
  search: z.string().trim().min(1).max(POST_LIMITS.SEARCH).optional(),
})
export type ListPostsQuery = z.output<typeof listPostsQuerySchema>

export const listPublishedPostsQuerySchema = z.object({
  page: pageSchema,
  pageSize: z.coerce.number().int().min(1).max(POST_LIMITS.PUBLIC_PAGE_SIZE).default(10),
  tag: z.string().trim().min(1).max(TAG_MAX_LENGTH).optional(),
})
export type ListPublishedPostsQuery = z.output<typeof listPublishedPostsQuerySchema>
