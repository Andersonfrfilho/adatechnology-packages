/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Republicar e publicar no horário. `publishDue` é o que o host chama num intervalo: marca como
 * publicado o que estava agendado e já venceu, e materializa as recorrências vencidas.
 */

import {
  POST_EVENT,
  POST_STATUS,
  PostNotPublishedError,
  republishPostSchema,
  RepublishDateInFutureError,
  SLUG_MAX_LENGTH,
  slugify,
  type Post,
  type RepublishPostInput,
} from '@adatechnology/content-contracts'

import { notifyPostChanged } from '../shared/notifyPostChanged'
import { nextOccurrenceAfter, toDateStamp } from '../shared/recurrence'
import { effectiveStatus, toPost } from '../shared/toContract'
import type { RecurrenceRow } from '../schema/schema'
import { PostUseCaseBase, type PostReference } from './Post.use-cases'
import { copiableFields } from './Template.use-cases'

const DEFAULT_BATCH_LIMIT = 100
const DATE_SUFFIX_LENGTH = 11
const FALLBACK_SLUG = 'post'

export class RepublishPostUseCase extends PostUseCaseBase {
  /**
   * Muda a data de um post JÁ publicado, mantendo o MESMO endereço. É a opção segura para SEO: o
   * link antigo (compartilhado, indexado, com backlinks) continua valendo e não nasce conteúdo
   * duplicado. Data futura é recusada — o post sairia do ar até lá e o leitor veria 404.
   */
  async execute(params: PostReference & { readonly input?: RepublishPostInput }): Promise<Post> {
    const input = republishPostSchema.parse(params.input ?? {})
    const existing = await this.findOrFail(params)
    const now = this.now()
    if (existing.isTemplate || effectiveStatus(existing, now) !== POST_STATUS.PUBLISHED) {
      throw new PostNotPublishedError(params.id)
    }
    const publishedAt = input.publishedAt ? new Date(input.publishedAt) : now
    if (publishedAt > now) throw new RepublishDateInFutureError()
    return this.save(params, { status: POST_STATUS.PUBLISHED, publishedAt }, POST_EVENT.REPUBLISHED)
  }
}

export type PublishDueResult = { readonly published: number; readonly materialized: number }

export class PublishDueUseCase extends PostUseCaseBase {
  /**
   * Idempotente e seguro com várias instâncias chamando ao mesmo tempo: cada post/regra é reclamado
   * por uma só execução. Sem trabalho vencido, não faz nada. `now` existe para teste e reprocesso.
   */
  async execute(params: { readonly now?: Date; readonly limit?: number } = {}): Promise<PublishDueResult> {
    const now = params.now ?? this.now()
    const limit = params.limit ?? DEFAULT_BATCH_LIMIT
    const materialized = await this.materializeRecurrences({ now, limit })
    const rows = await this.dependencies.posts.claimDueScheduled({ now, limit })
    for (const row of rows) {
      await notifyPostChanged(this.dependencies, POST_EVENT.PUBLISHED, toPost(row, now))
    }
    if (rows.length > 0 || materialized > 0) {
      this.dependencies.logger?.info('content-module: publishDue', { published: rows.length, materialized })
    }
    return { published: rows.length, materialized }
  }

  private materializeRecurrences(params: { now: Date; limit: number }): Promise<number> {
    return this.dependencies.recurrences.processDue({
      ...params,
      handle: (rule) => this.materialize(rule, params.now),
    })
  }

  /** Um post publicado agora a partir do modelo; a regra avança para a próxima data futura. */
  private async materialize(rule: RecurrenceRow, now: Date): Promise<Partial<RecurrenceRow>> {
    const advance = {
      nextRunAt: nextOccurrenceAfter({
        frequency: rule.frequency as 'weekly' | 'monthly',
        from: rule.nextRunAt,
        anchorDay: rule.anchorDay,
        now,
      }),
    }
    const template = await this.dependencies.posts.findById({ companyId: rule.companyId, id: rule.templateId })
    if (!template || !template.isTemplate || template.status === POST_STATUS.ARCHIVED) {
      // Modelo apagado: a regra para de rodar em vez de falhar a cada ciclo.
      this.dependencies.logger?.warn('content-module: modelo da recorrência indisponível', { ruleId: rule.id })
      return { isActive: false }
    }
    const base = (slugify(template.title) || FALLBACK_SLUG).slice(0, SLUG_MAX_LENGTH - DATE_SUFFIX_LENGTH)
    const slug = await this.uniqueSlug(rule.companyId, `${base.replace(/-+$/g, '')}-${toDateStamp(now)}`)
    const row = await this.dependencies.posts.create({
      ...copiableFields(template),
      companyId: rule.companyId,
      slug,
      shortId: await this.generateShortId(rule.companyId),
      title: template.title,
      isTemplate: false,
      status: POST_STATUS.PUBLISHED,
      publishedAt: now,
    })
    const post = toPost(row, now)
    await notifyPostChanged(this.dependencies, POST_EVENT.CREATED, post)
    await notifyPostChanged(this.dependencies, POST_EVENT.PUBLISHED, post)
    return { ...advance, lastRunAt: now, lastPostId: row.id }
  }
}
