/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Modelos de post: salvar um post como modelo e criar um post novo a partir de um modelo. Modelo é
 * post com `isTemplate`: nunca vai ao ar, não aparece na lista de posts e não tem endereço público.
 */

import {
  createFromTemplateSchema,
  DuplicateSlugError,
  normalizeTags,
  NotATemplateError,
  POST_EVENT,
  POST_STATUS,
  saveAsTemplateSchema,
  type CreateFromTemplateInput,
  type Post,
  type PostCounts,
  type SaveAsTemplateInput,
} from '@adatechnology/content-contracts'

import type { NewPostRow, PostRow } from '../schema/schema'
import { isUniqueViolation } from '../shared/isUniqueViolation'
import { notifyPostChanged } from '../shared/notifyPostChanged'
import { toPost } from '../shared/toContract'
import { PostUseCaseBase, type PostReference } from './Post.use-cases'

const TEMPLATE_SLUG_PREFIX = 'modelo'

/**
 * Conteúdo reaproveitável de um post. `canonicalUrl` NÃO é copiado: o canonical do original apontaria
 * o buscador para outra página e esconderia o post novo.
 */
export function copiableFields(row: PostRow): Partial<NewPostRow> {
  return {
    excerpt: row.excerpt,
    body: row.body,
    coverImageUrl: row.coverImageUrl,
    coverImageAlt: row.coverImageAlt,
    tags: normalizeTags(row.tags),
    tagLabels: row.tagLabels,
    authorName: row.authorName,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    readingTimeMinutes: row.readingTimeMinutes,
  }
}

abstract class TemplateUseCaseBase extends PostUseCaseBase {
  protected async insertCopy(params: {
    readonly companyId: string
    readonly slug: string
    readonly title: string
    readonly source: PostRow
    readonly isTemplate: boolean
    readonly status?: string
    readonly publishedAt?: Date
  }): Promise<Post> {
    const row = await this.dependencies.posts
      .create({
        ...copiableFields(params.source),
        companyId: params.companyId,
        slug: params.slug,
        shortId: await this.generateShortId(params.companyId),
        title: params.title,
        isTemplate: params.isTemplate,
        status: params.status ?? POST_STATUS.DRAFT,
        ...(params.publishedAt ? { publishedAt: params.publishedAt } : {}),
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new DuplicateSlugError(params.slug)
        throw error
      })
    const post = toPost(row, this.now())
    await notifyPostChanged(this.dependencies, POST_EVENT.CREATED, post)
    return post
  }
}

export class SaveAsTemplateUseCase extends TemplateUseCaseBase {
  /** Copia o post (qualquer status) para um modelo. O original não muda. */
  async execute(params: PostReference & { readonly input?: SaveAsTemplateInput }): Promise<Post> {
    const input = saveAsTemplateSchema.parse(params.input ?? {})
    const source = await this.findOrFail(params)
    const title = input.title ?? source.title
    const slug = await this.generateSlug(params.companyId, `${TEMPLATE_SLUG_PREFIX} ${title}`)
    return this.insertCopy({ companyId: params.companyId, slug, title, source, isTemplate: true })
  }
}

export class CreateFromTemplateUseCase extends TemplateUseCaseBase {
  /** Cria um RASCUNHO novo com o conteúdo do modelo, pronto para editar e publicar. */
  async execute(params: PostReference & { readonly input?: CreateFromTemplateInput }): Promise<Post> {
    const input = createFromTemplateSchema.parse(params.input ?? {})
    const template = await this.findOrFail(params)
    if (!template.isTemplate) throw new NotATemplateError(params.id)
    const title = input.title ?? template.title
    if (input.slug) await this.assertSlugAvailable(params.companyId, input.slug)
    const slug = input.slug ?? (await this.generateSlug(params.companyId, title))
    return this.insertCopy({ companyId: params.companyId, slug, title, source: template, isTemplate: false })
  }
}

export class CountPostsUseCase extends PostUseCaseBase {
  /** Números das abas do painel, numa consulta só. */
  async execute(params: { readonly companyId: string }): Promise<PostCounts> {
    return this.dependencies.posts.countByStatus({ companyId: params.companyId, now: this.now() })
  }
}
