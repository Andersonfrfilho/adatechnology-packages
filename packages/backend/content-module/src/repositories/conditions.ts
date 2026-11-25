/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Toda condição alcançável por uma requisição vive aqui como função pura exportada — a mesma que o
 * repositório chama e que `isolation.test.ts` renderiza em SQL. Um refactor que esqueça o filtro
 * de empresa quebra o teste na hora.
 */

import { and, arrayContains, eq, gt, inArray, lte, or, sql, type SQL } from 'drizzle-orm'
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
  tag?: string
  search?: string
  now: Date
}): SQL {
  const conditions: SQL[] = [eq(posts.companyId, params.companyId)]
  if (params.status) conditions.push(statusCondition(params.status, params.now))
  if (params.tag) conditions.push(arrayContains(posts.tags, [params.tag]))
  if (params.search) {
    const pattern = `%${params.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`
    conditions.push(sql`(${posts.title} ilike ${pattern} or ${posts.slug} ilike ${pattern})`)
  }
  return and(...conditions) as SQL
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
