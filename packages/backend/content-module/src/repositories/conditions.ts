/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Toda condição alcançável por uma requisição vive aqui como função pura exportada — a mesma que o
 * repositório chama e que `isolation.test.ts` renderiza em SQL. Um refactor que esqueça o filtro
 * de empresa quebra o teste na hora.
 */

import { and, arrayContains, arrayOverlaps, eq, gt, inArray, lte, ne, or, sql, type SQL } from 'drizzle-orm'
import { POST_STATUS, type PostStatus } from '@adatechnology/content-contracts'

import { posts } from '../schema/schema'

export function postOwnedByCondition(params: { companyId: string; id: string }): SQL {
  return and(eq(posts.companyId, params.companyId), eq(posts.id, params.id)) as SQL
}

export function postSlugCondition(params: { companyId: string; slug: string }): SQL {
  return and(eq(posts.companyId, params.companyId), eq(posts.slug, params.slug)) as SQL
}

export function postAdminListCondition(params: {
  companyId: string
  status?: PostStatus
  tags?: readonly string[]
  search?: string
  /** `true`: só modelos (menos os arquivados). Ausente/`false`: só posts — modelo nunca aparece misturado. */
  isTemplate?: boolean
  now: Date
}): SQL {
  const conditions: SQL[] = [eq(posts.companyId, params.companyId), templateCondition(params.isTemplate)]
  if (params.status) conditions.push(statusCondition(params.status, params.now))
  if (params.tags?.length) conditions.push(arrayOverlaps(posts.tags, [...params.tags]))
  if (params.search) {
    const pattern = `%${params.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`
    conditions.push(sql`(${posts.title} ilike ${pattern} or ${posts.slug} ilike ${pattern})`)
  }
  return and(...conditions) as SQL
}

function templateCondition(isTemplate: boolean | undefined): SQL {
  if (isTemplate) return and(eq(posts.isTemplate, true), ne(posts.status, POST_STATUS.ARCHIVED)) as SQL
  return eq(posts.isTemplate, false)
}

/**
 * Filtra pelo status que o painel MOSTRA: agendado cuja hora passou aparece como publicado, então
 * o filtro "publicados" o inclui e o filtro "agendados" o exclui.
 */
function statusCondition(status: PostStatus, now: Date): SQL {
  if (status === POST_STATUS.PUBLISHED) {
    return or(
      eq(posts.status, POST_STATUS.PUBLISHED),
      and(eq(posts.status, POST_STATUS.SCHEDULED), lte(posts.publishedAt, now)),
    ) as SQL
  }
  if (status === POST_STATUS.SCHEDULED) {
    return and(eq(posts.status, POST_STATUS.SCHEDULED), gt(posts.publishedAt, now)) as SQL
  }
  return eq(posts.status, status)
}

/**
 * Público = publicado ou agendado cuja hora chegou. `scheduled` entra na condição justamente para
 * que o agendamento valha sem cron: no instante de `published_at` o post passa a casar aqui.
 */
export function postPublicCondition(params: { companyId: string; now: Date; tag?: string }): SQL {
  const conditions: SQL[] = [
    eq(posts.companyId, params.companyId),
    inArray(posts.status, [POST_STATUS.PUBLISHED, POST_STATUS.SCHEDULED]),
    lte(posts.publishedAt, params.now),
  ]
  if (params.tag) conditions.push(arrayContains(posts.tags, [params.tag]))
  return and(...conditions) as SQL
}

export function postPublicSlugCondition(params: { companyId: string; slug: string; now: Date }): SQL {
  return and(postPublicCondition(params), eq(posts.slug, params.slug)) as SQL
}

/**
 * Agendado cuja hora chegou, de qualquer empresa: é a única condição sem `company_id`, de propósito —
 * o `publishDue` é tarefa do sistema e varre todas as empresas. Modelo nunca entra.
 */
export function postDueCondition(params: { now: Date }): SQL {
  return and(
    eq(posts.status, POST_STATUS.SCHEDULED),
    eq(posts.isTemplate, false),
    lte(posts.publishedAt, params.now),
  ) as SQL
}

export function postShortIdCondition(params: { companyId: string; shortId: string }): SQL {
  return and(eq(posts.companyId, params.companyId), eq(posts.shortId, params.shortId)) as SQL
}

export function postPublicShortIdCondition(params: { companyId: string; shortId: string; now: Date }): SQL {
  return and(postPublicCondition(params), eq(posts.shortId, params.shortId)) as SQL
}
