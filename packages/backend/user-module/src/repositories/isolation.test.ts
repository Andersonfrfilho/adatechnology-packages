/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Isolamento multiempresa: renderiza o SQL real de cada condição exportada com `PgDialect` e
 * prova que o escopo por tenant está em toda cláusula — sem precisar de Postgres. Cobre os dois
 * modos (`single`: `company_id IS NULL`; `multi`: `company_id = $1`), já que produtos futuros
 * ainda não decidiram qual modo vão usar.
 */

import { describe, expect, it } from 'bun:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

import {
  userByEmailCondition,
  userByProviderExternalCondition,
  userListCondition,
  userOwnedByCondition,
  userScopeCondition,
} from './conditions'

const dialect = new PgDialect()
const render = (expression: SQL): string => dialect.sqlToQuery(expression).sql
const renderParams = (expression: SQL): readonly unknown[] => dialect.sqlToQuery(expression).params

describe('modo multi-tenant escopa por company_id', () => {
  const params = { companyId: 'company-a', id: 'user-1', email: 'user@example.com' }

  const conditions: Record<string, SQL> = {
    userOwnedByCondition: userOwnedByCondition(params),
    userListCondition: userListCondition(params),
    userByEmailCondition: userByEmailCondition(params),
  }

  for (const [name, condition] of Object.entries(conditions)) {
    it(`${name} inclui company_id`, () => {
      expect(render(condition)).toContain('company_id')
    })
  }

  it('empresas diferentes vinculam parâmetros diferentes', () => {
    const companyA = userListCondition({ companyId: 'company-a' })
    const companyB = userListCondition({ companyId: 'company-b' })

    expect(render(companyA)).toEqual(render(companyB))
    expect(renderParams(companyA)).toContain('company-a')
    expect(renderParams(companyB)).not.toContain('company-a')
  })
})

describe('modo single-tenant escopa por company_id IS NULL', () => {
  it('userScopeCondition(undefined) renderiza IS NULL, não um parâmetro vinculado', () => {
    const sql = render(userScopeCondition(undefined))
    expect(sql.toLowerCase()).toContain('is null')
    expect(renderParams(userScopeCondition(undefined))).toHaveLength(0)
  })

  it('userOwnedByCondition em modo single ainda filtra deleted_at', () => {
    expect(render(userOwnedByCondition({ companyId: undefined, id: 'user-1' }))).toContain('deleted_at')
  })
})

describe('soft delete não vaza usuário apagado', () => {
  it('condições de leitura por escopo filtram deleted_at is null', () => {
    const params = { companyId: 'company-a', id: 'user-1', email: 'user@example.com' }
    expect(render(userOwnedByCondition(params))).toContain('deleted_at')
    expect(render(userListCondition(params))).toContain('deleted_at')
    expect(render(userByEmailCondition(params))).toContain('deleted_at')
  })

  it('busca por provider/externalId (Keycloak) filtra deleted_at e o tenant', () => {
    const scoped = render(
      userByProviderExternalCondition({ companyId: 'company-a', providerId: 'keycloak', externalId: 'sub-1' }),
    )
    expect(scoped).toContain('company_id')
    expect(scoped).toContain('deleted_at')
  })

  // O mesmo `sub` do Keycloak em duas empresas são dois usuários. Sem o escopo, a segunda empresa
  // reaproveitaria a linha da primeira e receberia sessão do tenant errado.
  it('busca por provider/externalId em single-tenant casa company_id nulo, não qualquer empresa', () => {
    const single = render(
      userByProviderExternalCondition({ companyId: undefined, providerId: 'keycloak', externalId: 'sub-1' }),
    )
    expect(single).toContain('company_id')
    expect(single).toContain('is null')
  })
})
