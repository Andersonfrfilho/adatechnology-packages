/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Renderiza o SQL real de cada condição exportada e prova que `company_id` está em toda cláusula —
 * sem Postgres. Testa as funções que a produção chama, não uma reconstrução delas.
 */

import { describe, expect, it } from 'bun:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

import {
  postAdminListCondition,
  postDueCondition,
  postOwnedByCondition,
  postPublicCondition,
  postPublicSlugCondition,
  postSlugCondition,
} from './conditions'

const dialect = new PgDialect()
const render = (expression: SQL) => dialect.sqlToQuery(expression)
const now = new Date('2026-11-20T12:00:00.000Z')

describe('toda condição escopa por company_id', () => {
  const conditions: Record<string, SQL> = {
    postOwnedByCondition: postOwnedByCondition({ companyId: 'company-a', id: 'post-1' }),
    postSlugCondition: postSlugCondition({ companyId: 'company-a', slug: 'a' }),
    postAdminListCondition: postAdminListCondition({
      companyId: 'company-a',
      status: 'published',
      tags: ['x', 'z'],
      search: 'y',
      now,
    }),
    postPublicCondition: postPublicCondition({ companyId: 'company-a', now, tag: 'x' }),
    postPublicSlugCondition: postPublicSlugCondition({ companyId: 'company-a', slug: 'a', now }),
  }

  for (const [name, condition] of Object.entries(conditions)) {
    it(name, () => {
      const query = render(condition)
      expect(query.sql).toContain('"company_id" = $1')
      expect(query.params[0]).toBe('company-a')
    })
  }
})

describe('condição pública', () => {
  it('exige status no ar e published_at <= agora', () => {
    const query = render(postPublicCondition({ companyId: 'company-a', now }))
    expect(query.sql).toContain('"status" in (')
    expect(query.sql).toContain('"published_at" <= ')
    expect(query.params).toContain('published')
    expect(query.params).toContain('scheduled')
    expect(query.params).not.toContain('draft')
  })

  it('a busca do painel escapa curinga do LIKE', () => {
    const query = render(postAdminListCondition({ companyId: 'company-a', search: '100%_off', now }))
    expect(query.params).toContain('%100\\%\\_off%')
  })
})

describe('condição de vencidos (tarefa do sistema)', () => {
  it('é a única sem company_id; exige agendado, vencido e nunca modelo', () => {
    const query = render(postDueCondition({ now }))
    expect(query.sql).not.toContain('company_id')
    expect(query.sql).toContain('"status" = $')
    expect(query.sql).toContain('"is_template" = $')
    expect(query.sql).toContain('"published_at" <= $')
    expect(query.params).toContain('scheduled')
    expect(query.params).toContain(false)
  })

  it('a lista do painel esconde modelo por padrão e só mostra modelo quando pedido', () => {
    const posts = render(postAdminListCondition({ companyId: 'company-a', now }))
    expect(posts.params).toContain(false)
    const templates = render(postAdminListCondition({ companyId: 'company-a', isTemplate: true, now }))
    expect(templates.params).toContain(true)
    expect(templates.params).toContain('archived')
  })
})
