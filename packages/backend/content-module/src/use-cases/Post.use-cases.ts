/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Casos de uso do painel: criar, editar, arquivar, publicar/agendar, despublicar, ler e listar.
 * Todos validam a entrada com o schema do contracts de novo — o host pode chamar o use-case sem
 * passar pela rota, e a regra não pode depender de quem chamou.
 */

import {
  buildTagLabels,
  createPostSchema,
  DuplicateSlugError,
  estimateReadingTimeMinutes,
  listPostsQuerySchema,
  normalizeTags,
  POST_EVENT,
  POST_STATUS,
  PostNotFoundError,
  TemplateNotPublishableError,
  publishPostSchema,
  buildShortSlug,
  updatePostSchema,
  withSlugSuffix,
  type CreatePostInput,
  type ListPostsQuery,
  type Paginated,
  type Post,
  type PostEventType,
  type PostSummary,
  type PublishPostInput,
  type UpdatePostInput,
} from '@adatechnology/content-contracts'

import type { NewPostRow, PostRow } from '../schema/schema'
import { generateShortId } from '../shared/shortId'
import { isUniqueViolation } from '../shared/isUniqueViolation'
import { notifyPostChanged } from '../shared/notifyPostChanged'
import { toPagination, toPost, toPostSummary } from '../shared/toContract'
import type { ContentDependencies } from './contentModule.types'

const MAX_SLUG_ATTEMPTS = 50
const FALLBACK_SLUG = 'post'

export type PostReference = { readonly companyId: string; readonly id: string }

export abstract class PostUseCaseBase {
  constructor(protected readonly dependencies: ContentDependencies) {}

  protected now(): Date {
    return this.dependencies.clock.now()
  }

  protected async findOrFail(reference: PostReference): Promise<PostRow> {
    const row = await this.dependencies.posts.findById(reference)
    if (!row) throw new PostNotFoundError(reference.id)
    return row
  }

  protected async save(reference: PostReference, values: Partial<NewPostRow>, event: PostEventType): Promise<Post> {
    const row = await this.dependencies.posts.update({ ...reference, values }).catch((error: unknown) => {
      if (isUniqueViolation(error) && values.slug) throw new DuplicateSlugError(values.slug)
      throw error
    })
    if (!row) throw new PostNotFoundError(reference.id)
    const post = toPost(row, this.now())
    await notifyPostChanged(this.dependencies, event, post)
    return post
  }

  /** Id curto livre na empresa; a colisão (~1 em 2 bilhões) só repete o sorteio. */
  protected async generateShortId(companyId: string): Promise<string> {
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
      const candidate = generateShortId()
      if (!(await this.dependencies.posts.findByShortId({ companyId, shortId: candidate }))) return candidate
    }
    throw new Error('content-module: sem id curto livre')
  }

  protected readingTime(body: string): number {
    return estimateReadingTimeMinutes(body, this.dependencies.config.wordsPerMinute)
  }

  protected async assertSlugAvailable(companyId: string, slug: string, ownId?: string): Promise<void> {
    const existing = await this.dependencies.posts.findBySlug({ companyId, slug })
    if (existing && existing.id !== ownId) throw new DuplicateSlugError(slug)
  }

  /** `titulo`, `titulo-2`, `titulo-3`… Sequencial de propósito: cada tentativa depende da anterior. */
  protected async generateSlug(companyId: string, title: string): Promise<string> {
    return this.uniqueSlug(companyId, buildShortSlug(title, this.dependencies.config.slug) || FALLBACK_SLUG)
  }

  protected async uniqueSlug(companyId: string, base: string): Promise<string> {
    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
      const candidate = withSlugSuffix(base, attempt)
      if (!(await this.dependencies.posts.findBySlug({ companyId, slug: candidate }))) return candidate
    }
    return withSlugSuffix(base, Date.now())
  }
}

function optionalFields(
  input: Omit<UpdatePostInput, 'slug' | 'title' | 'body' | 'tags' | 'tagLabels'>,
): Partial<NewPostRow> {
  const values: Partial<NewPostRow> = {}
  if (input.excerpt !== undefined) values.excerpt = input.excerpt || null
  if (input.coverImageUrl !== undefined) values.coverImageUrl = input.coverImageUrl || null
  if (input.coverImageAlt !== undefined) values.coverImageAlt = input.coverImageAlt || null
  if (input.authorName !== undefined) values.authorName = input.authorName || null
  if (input.seoTitle !== undefined) values.seoTitle = input.seoTitle || null
  if (input.seoDescription !== undefined) values.seoDescription = input.seoDescription || null
  if (input.canonicalUrl !== undefined) values.canonicalUrl = input.canonicalUrl || null
  return values
}

export class CreatePostUseCase extends PostUseCaseBase {
  async execute(params: { readonly companyId: string; readonly input: CreatePostInput }): Promise<Post> {
    const input = createPostSchema.parse(params.input)
    const { companyId } = params
    if (input.slug) await this.assertSlugAvailable(companyId, input.slug)
    const slug = input.slug ?? (await this.generateSlug(companyId, input.title))

    const row = await this.dependencies.posts
      .create({
        companyId,
        slug,
        shortId: await this.generateShortId(companyId),
        title: input.title,
        body: input.body,
        tags: normalizeTags(input.tags ?? []),
        tagLabels: buildTagLabels({ typed: input.tags ?? [], explicit: input.tagLabels }),
        status: POST_STATUS.DRAFT,
        readingTimeMinutes: this.readingTime(input.body),
        ...optionalFields(input),
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new DuplicateSlugError(slug)
        throw error
      })

    const post = toPost(row, this.now())
    await notifyPostChanged(this.dependencies, POST_EVENT.CREATED, post)
    return post
  }
}

export class UpdatePostUseCase extends PostUseCaseBase {
  /** Trocar o título não muda o slug: o endereço já pode ter sido compartilhado. */
  async execute(params: PostReference & { readonly input: UpdatePostInput }): Promise<Post> {
    const input = updatePostSchema.parse(params.input)
    const existing = await this.findOrFail(params)

    const values: Partial<NewPostRow> = optionalFields(input)
    if (input.title !== undefined) values.title = input.title
    if (input.body !== undefined) {
      values.body = input.body
      values.readingTimeMinutes = this.readingTime(input.body)
    }
    if (input.tags !== undefined || input.tagLabels !== undefined) {
      const tags = normalizeTags(input.tags ?? existing.tags)
      values.tags = tags
      values.tagLabels = buildTagLabels({
        typed: input.tags ?? tags,
        explicit: input.tagLabels,
        previous: existing.tagLabels,
      })
    }
    if (input.slug !== undefined && input.slug !== existing.slug) {
      await this.assertSlugAvailable(params.companyId, input.slug, existing.id)
      values.slug = input.slug
      // O endereço antigo continua abrindo o post: o host o redireciona ao canônico.
      await this.dependencies.posts.recordFormerSlug({
        companyId: params.companyId,
        postId: existing.id,
        slug: existing.slug,
      })
    }
    return this.save(params, values, POST_EVENT.UPDATED)
  }
}

export class PublishPostUseCase extends PostUseCaseBase {
  /** Sem data: publica agora. Data futura: agenda. Data passada: publica com a data informada. */
  async execute(params: PostReference & { readonly input?: PublishPostInput }): Promise<Post> {
    const input = publishPostSchema.parse(params.input ?? {})
    const existing = await this.findOrFail(params)
    if (existing.isTemplate) throw new TemplateNotPublishableError(params.id)
    const now = this.now()
    const publishedAt = input.publishedAt ? new Date(input.publishedAt) : now
    const status = publishedAt > now ? POST_STATUS.SCHEDULED : POST_STATUS.PUBLISHED
    return this.save(params, { status, publishedAt }, POST_EVENT.PUBLISHED)
  }
}

export class UnpublishPostUseCase extends PostUseCaseBase {
  /** Volta a rascunho e tira do ar na hora, inclusive cancelando um agendamento. */
  async execute(params: PostReference): Promise<Post> {
    await this.findOrFail(params)
    return this.save(params, { status: POST_STATUS.DRAFT, publishedAt: null }, POST_EVENT.UNPUBLISHED)
  }
}

export class ArchivePostUseCase extends PostUseCaseBase {
  /** "Excluir" no painel é arquivar: some do site, mas o conteúdo e o slug continuam guardados. */
  async execute(params: PostReference): Promise<Post> {
    await this.findOrFail(params)
    return this.save(params, { status: POST_STATUS.ARCHIVED }, POST_EVENT.ARCHIVED)
  }
}

export class GetPostUseCase extends PostUseCaseBase {
  async execute(params: PostReference): Promise<Post> {
    return toPost(await this.findOrFail(params), this.now())
  }
}

export class ListPostsUseCase extends PostUseCaseBase {
  async execute(params: { readonly companyId: string } & Partial<ListPostsQuery>): Promise<Paginated<PostSummary>> {
    const { companyId, ...rawQuery } = params
    const query = listPostsQuerySchema.parse(rawQuery)
    const tag = query.tag ? normalizeTags([query.tag])[0] : undefined
    const now = this.now()
    const page = await this.dependencies.posts.listForAdmin({
      companyId,
      ...query,
      isTemplate: query.isTemplate ?? false,
      now,
      ...(tag ? { tag } : {}),
    })
    return {
      data: page.rows.map((row) => toPostSummary(row, now)),
      pagination: toPagination({ total: page.total, page: query.page, pageSize: query.pageSize }),
    }
  }
}
