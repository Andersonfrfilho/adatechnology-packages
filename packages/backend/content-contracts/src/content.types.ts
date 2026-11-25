/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Tipos do trio de conteúdo (blog, novidades, notícias). Nada aqui conhece o app que consome:
 * o vocabulário é "post", e o host decide se chama isso de blog, novidades ou artigos.
 */

/**
 * `scheduled` é publicação com data futura. O post vira público no instante de `publishedAt`
 * sem cron nenhum: a leitura pública compara com o relógio, e a projeção para o contrato já
 * devolve `published` quando o instante passou.
 */
export const POST_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const
export type PostStatus = (typeof POST_STATUS)[keyof typeof POST_STATUS]

export const POST_STATUSES: readonly PostStatus[] = Object.values(POST_STATUS)

export function isPostStatus(value: unknown): value is PostStatus {
  return typeof value === 'string' && (POST_STATUSES as readonly string[]).includes(value)
}

/** Visão do painel: tudo, inclusive rascunho e campos de operação. */
export type Post = {
  readonly id: string
  readonly companyId: string
  readonly slug: string
  readonly title: string
  readonly excerpt: string | null
  /** Markdown. Nunca HTML: a renderização segura fica em `renderMarkdownToHtml`/`parseMarkdown`. */
  readonly body: string
  readonly coverImageUrl: string | null
  readonly coverImageAlt: string | null
  readonly tags: readonly string[]
  readonly status: PostStatus
  /** ISO 8601. Em `scheduled`, o instante em que o post fica público. */
  readonly publishedAt: string | null
  readonly authorName: string | null
  readonly seoTitle: string | null
  readonly seoDescription: string | null
  readonly canonicalUrl: string | null
  readonly readingTimeMinutes: number
  readonly createdAt: string
  readonly updatedAt: string
}

/** Item de listagem do painel: sem o corpo, que pode ter dezenas de KB por post. */
export type PostSummary = Omit<Post, 'body'>

/**
 * Visão pública: sem `companyId`, sem status e sem nada de operação. Só existe post publicado
 * aqui, então status seria sempre o mesmo valor.
 */
export type PublicPost = {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly excerpt: string | null
  readonly body: string
  readonly coverImageUrl: string | null
  readonly coverImageAlt: string | null
  readonly tags: readonly string[]
  readonly publishedAt: string
  readonly updatedAt: string
  readonly authorName: string | null
  readonly seoTitle: string | null
  readonly seoDescription: string | null
  readonly canonicalUrl: string | null
  readonly readingTimeMinutes: number
}

export type PublicPostSummary = Omit<PublicPost, 'body'>

export type TagCount = {
  readonly tag: string
  readonly count: number
}

export type Pagination = {
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly totalPages: number
}

export type Paginated<TItem> = {
  readonly data: readonly TItem[]
  readonly pagination: Pagination
}
