/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Estado do editor como dado puro: rascunho ↔ post, detecção de alteração e validação com o
 * mesmo schema que o servidor aplica.
 */

import { createPostSchema, slugify, type CreatePostInput, type Post } from '@adatechnology/content-contracts'

export type PostDraft = {
  readonly title: string
  readonly slug: string
  readonly excerpt: string
  readonly body: string
  readonly coverImageUrl: string
  readonly coverImageAlt: string
  readonly tags: readonly string[]
  readonly authorName: string
  readonly seoTitle: string
  readonly seoDescription: string
  readonly canonicalUrl: string
}

export const EMPTY_POST_DRAFT: PostDraft = {
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  coverImageUrl: '',
  coverImageAlt: '',
  tags: [],
  authorName: '',
  seoTitle: '',
  seoDescription: '',
  canonicalUrl: '',
}

export function draftFromPost(post: Post | undefined, defaults: Partial<PostDraft> = {}): PostDraft {
  if (!post) return { ...EMPTY_POST_DRAFT, ...defaults }
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? '',
    body: post.body,
    coverImageUrl: post.coverImageUrl ?? '',
    coverImageAlt: post.coverImageAlt ?? '',
    tags: post.tags,
    authorName: post.authorName ?? '',
    seoTitle: post.seoTitle ?? '',
    seoDescription: post.seoDescription ?? '',
    canonicalUrl: post.canonicalUrl ?? '',
  }
}

const nullable = (value: string): string | null => (value.trim() ? value.trim() : null)

/** Campo vazio vira `null` (apaga no servidor); slug vazio é omitido (o servidor gera). */
export function draftToInput(draft: PostDraft): CreatePostInput {
  return {
    title: draft.title.trim(),
    ...(draft.slug.trim() ? { slug: draft.slug.trim() } : {}),
    excerpt: nullable(draft.excerpt),
    body: draft.body,
    coverImageUrl: nullable(draft.coverImageUrl),
    coverImageAlt: nullable(draft.coverImageAlt),
    tags: [...draft.tags],
    authorName: nullable(draft.authorName),
    seoTitle: nullable(draft.seoTitle),
    seoDescription: nullable(draft.seoDescription),
    canonicalUrl: nullable(draft.canonicalUrl),
  }
}

export function isDraftDirty(draft: PostDraft, baseline: PostDraft): boolean {
  return JSON.stringify(draft) !== JSON.stringify(baseline)
}

/** Enquanto o autor não mexe no slug de um post novo, ele acompanha o título. */
export function deriveSlug(params: {
  readonly title: string
  readonly slug: string
  readonly slugTouched: boolean
}): string {
  return params.slugTouched ? params.slug : slugify(params.title)
}

export const DRAFT_ERROR = {
  TITLE: 'title',
  SLUG: 'slug',
  COVER_IMAGE_URL: 'coverImageUrl',
  CANONICAL_URL: 'canonicalUrl',
} as const
export type DraftErrorField = (typeof DRAFT_ERROR)[keyof typeof DRAFT_ERROR]

export function validateDraft(draft: PostDraft): Partial<Record<DraftErrorField, true>> {
  const result = createPostSchema.safeParse(draftToInput(draft))
  if (result.success) return {}
  const errors: Partial<Record<DraftErrorField, true>> = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0]
    if (field === 'title' || field === 'slug' || field === 'coverImageUrl' || field === 'canonicalUrl')
      errors[field] = true
  }
  return errors
}

/** Entrada do campo de tags: separa por vírgula/quebra e normaliza como o servidor fará. */
export function splitTagInput(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((tag) => tag.trim().replace(/\s+/g, ' ').toLowerCase())
    .filter(Boolean)
}
