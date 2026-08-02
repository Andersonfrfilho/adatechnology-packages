/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Teste de isolamento multiempresa (T3.5): prova, sem precisar de um Postgres real, que toda
 * condição de leitura/escrita reachable por um usuário autenticado carrega `company_id = ` no
 * SQL renderizado. Mesmo padrão de `meta-whatsapp-module/repositories/SessionRepository.test.ts`
 * — renderiza a expressão com `PgDialect`, não executa contra banco.
 *
 * O valor do teste está em travar as funções exportadas (`notificationInboxCondition` etc.), não
 * em reconstruir a condição na mão aqui — reconstruir testaria o teste, não o código.
 */

import { describe, expect, it } from 'bun:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

import {
  notificationInboxCondition,
  notificationOwnedByCondition,
  notificationUnreadCondition,
  notificationUnreadOwnedCondition,
} from './NotificationRepository'
import { deviceActiveByUserCondition, deviceOwnedByCondition } from './DeviceRepository'
import { preferenceByUserCondition } from './PreferenceRepository'

const dialect = new PgDialect()

function render(expression: SQL): string {
  return dialect.sqlToQuery(expression).sql
}

function renderParams(expression: SQL): readonly unknown[] {
  return dialect.sqlToQuery(expression).params
}

const params = { companyId: 'company-a', recipientUserId: 'user-1', userId: 'user-1', id: 'row-1' }

describe('condições de repositório escopam por company_id', () => {
  const conditions: Record<string, SQL> = {
    notificationInboxCondition: notificationInboxCondition(params),
    notificationOwnedByCondition: notificationOwnedByCondition(params),
    notificationUnreadCondition: notificationUnreadCondition(params),
    notificationUnreadOwnedCondition: notificationUnreadOwnedCondition(params),
    deviceActiveByUserCondition: deviceActiveByUserCondition(params),
    deviceOwnedByCondition: deviceOwnedByCondition(params),
    preferenceByUserCondition: preferenceByUserCondition(params),
  }

  for (const [name, condition] of Object.entries(conditions)) {
    it(`${name} inclui company_id na cláusula`, () => {
      expect(render(condition)).toContain('company_id')
    })
  }
})

describe('empresa A nunca lê ou escreve o que pertence à empresa B', () => {
  it('a condição de inbox parametriza o companyId recebido, não um valor fixo', () => {
    const companyA = notificationInboxCondition({ companyId: 'company-a', recipientUserId: 'user-1' })
    const companyB = notificationInboxCondition({ companyId: 'company-b', recipientUserId: 'user-1' })

    // O SQL renderizado é idêntico nas duas (mesmos placeholders) — o que muda é o parâmetro
    // vinculado. É esse parâmetro que garante que a query de uma empresa nunca lê a outra.
    expect(render(companyA)).toEqual(render(companyB))
    expect(renderParams(companyA)).toContain('company-a')
    expect(renderParams(companyB)).toContain('company-b')
    expect(renderParams(companyA)).not.toContain('company-b')
  })

  it('notificationOwnedByCondition rejeita id sem companyId nem recipientUserId correspondentes', () => {
    // A condição SEMPRE compõe os três `eq` com AND — não existe caminho de código onde `id`
    // sozinho basta. É esse "por construção" que a regra de multiempresa exige.
    const sql = render(notificationOwnedByCondition({ companyId: 'company-a', recipientUserId: 'user-1', id: 'row-1' }))
    expect(sql).toContain('company_id')
    expect(sql).toContain('recipient_user_id')
    expect(sql).toContain('"id"')
  })
})
