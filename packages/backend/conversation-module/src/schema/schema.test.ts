/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O schema do núcleo é o alvo que a migração do produto de origem vai ter de acertar, então o teste
 * fixa a forma, não só a existência (spec 211 RF5, D1, P2; ADR-0085 §2 e §3):
 *
 * - a conversa com assunto e a sem assunto moram na mesma tabela e passam pelo mesmo caminho — o
 *   par `subject_type`/`subject_id` é anulável, só existe inteiro ou ausente, e nunca tem FK;
 * - nenhuma FK sai do schema do módulo: nem para tabela de produto, nem para `meta_whatsapp`, nem
 *   para uma tabela de empresas do host (o `company_id` vem do contexto autenticado, RNF3);
 * - o participante é `(canal, identificador)` e nada mais (RNF4);
 * - o que já estava certo na origem vai como está: CHECK de autoria, status idempotente por
 *   `(empresa, canal, id do provedor)`, `sha256` do anexo, e nenhum byte de arquivo no banco.
 */

import { describe, expect, it } from 'bun:test'
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core'

import { CONVERSATION_CHANNEL } from '@adatechnology/conversation-contracts'

import {
  CONVERSATION_SCHEMA_NAME,
  conversationAttachments,
  conversationMessages,
  conversationParticipants,
  conversationQuickReplies,
  conversationReads,
  conversations,
  conversationUnassigned,
  conversationUploads,
} from './schema'

const MODULE_TABLES = {
  conversations,
  participants: conversationParticipants,
  messages: conversationMessages,
  attachments: conversationAttachments,
  reads: conversationReads,
  unassigned: conversationUnassigned,
  quick_replies: conversationQuickReplies,
  uploads: conversationUploads,
} as const satisfies Record<string, PgTable>

const PRODUCT_WORDS = ['occ' + 'urrence', 'contr' + 'actor', 'dri' + 'ver']

type TableConfig = ReturnType<typeof getTableConfig>

function configOf(table: PgTable): TableConfig {
  return getTableConfig(table)
}

function column(table: PgTable, name: string): TableConfig['columns'][number] {
  const found = configOf(table).columns.find((candidate) => candidate.name === name)
  if (found === undefined) throw new Error(`coluna ausente: ${configOf(table).name}.${name}`)
  return found
}

function uniqueColumnSets(table: PgTable): string[][] {
  const config = configOf(table)
  const fromConstraints = config.uniqueConstraints.map((constraint) => constraint.columns.map((item) => item.name))
  const fromIndexes = config.indexes
    .filter((item) => item.config.unique && item.config.where === undefined)
    .map((item) => item.config.columns.map((part) => ('name' in part ? String(part.name) : '')))
  return [...fromConstraints, ...fromIndexes]
}

function checkNames(table: PgTable): string[] {
  return configOf(table).checks.map((item) => item.name)
}

describe('schema do núcleo de conversa', () => {
  it('vive inteiro no schema próprio do módulo, com a lista de tabelas fixa', () => {
    expect(CONVERSATION_SCHEMA_NAME).toBe('conversation')
    for (const [name, table] of Object.entries(MODULE_TABLES)) {
      const config = configOf(table)
      expect(config.schema).toBe(CONVERSATION_SCHEMA_NAME)
      expect(config.name).toBe(name)
    }
  })

  it('toda tabela carrega company_id obrigatório, e todo unique começa por ele', () => {
    for (const table of Object.values(MODULE_TABLES)) {
      const companyId = column(table, 'company_id')
      expect(companyId.notNull).toBe(true)
      expect(companyId.getSQLType()).toBe('uuid')
      for (const columns of uniqueColumnSets(table)) expect(columns[0]).toBe('company_id')
    }
  })

  it('o assunto é um par opaco, anulável, e só existe inteiro', () => {
    for (const name of ['subject_type', 'subject_id', 'audience']) {
      const subjectColumn = column(conversations, name)
      expect(subjectColumn.notNull).toBe(false)
      expect(subjectColumn.getSQLType()).toBe('text')
    }
    expect(checkNames(conversations)).toContain('conversations_subject_pair_check')

    const withSubject: typeof conversations.$inferInsert = {
      companyId: '6f0d8c8e-7a51-4ad3-9e2f-2d7c4a0c1b11',
      subjectType: 'order',
      subjectId: 'A-1027',
      audience: 'customer',
    }
    const withoutSubject: typeof conversations.$inferInsert = {
      companyId: '6f0d8c8e-7a51-4ad3-9e2f-2d7c4a0c1b11',
    }
    expect(withSubject.subjectType).toBe('order')
    expect(withoutSubject.subjectType).toBeUndefined()
  })

  it('uma conversa por (assunto, público) — o unique só vale para a conversa com assunto', () => {
    const subjectIndex = configOf(conversations).indexes.find(
      (item) => item.config.name === 'conversations_subject_audience_unique',
    )
    expect(subjectIndex?.config.unique).toBe(true)
    expect(subjectIndex?.config.where).toBeDefined()
  })

  it('nenhuma FK sai do schema do módulo, e a conversa não tem FK nenhuma', () => {
    const moduleTableNames = new Set(Object.values(MODULE_TABLES).map((table) => configOf(table).name))
    expect(configOf(conversations).foreignKeys).toHaveLength(0)
    for (const table of Object.values(MODULE_TABLES)) {
      for (const foreignKey of configOf(table).foreignKeys) {
        const target = getTableConfig(foreignKey.reference().foreignTable)
        expect(target.schema).toBe(CONVERSATION_SCHEMA_NAME)
        expect(moduleTableNames.has(target.name)).toBe(true)
        expect(foreignKey.reference().columns[0]?.name).toBe('company_id')
      }
    }
  })

  it('o participante é (canal, identificador) e nada mais', () => {
    const names = configOf(conversationParticipants)
      .columns.map((item) => item.name)
      .sort()
    expect(names).toEqual(['channel', 'company_id', 'conversation_id', 'created_at', 'id', 'identifier'])
    expect(uniqueColumnSets(conversationParticipants)).toContainEqual([
      'company_id',
      'conversation_id',
      'channel',
      'identifier',
    ])
  })

  it('a mensagem mantém autoria, status idempotente e o status que cada canal alcança', () => {
    expect(uniqueColumnSets(conversationMessages)).toContainEqual(['company_id', 'channel', 'provider_message_id'])
    const checks = checkNames(conversationMessages)
    for (const name of [
      'messages_channel_check',
      'messages_direction_check',
      'messages_author_check',
      'messages_status_check',
      'messages_status_direction_check',
      'messages_dkim_result_check',
      'messages_body_length_check',
    ]) {
      expect(checks).toContain(name)
    }
    for (const channel of CONVERSATION_CHANNEL) {
      expect(checks).toContain(`messages_${channel}_reachable_status_check`)
    }
  })

  it('o anexo guarda sha256 e referência de objeto — nenhum byte no banco', () => {
    expect(checkNames(conversationAttachments)).toContain('attachments_sha256_check')
    expect(column(conversationAttachments, 'object_key').notNull).toBe(true)
    for (const table of Object.values(MODULE_TABLES)) {
      for (const item of configOf(table).columns) expect(item.getSQLType()).not.toBe('bytea')
    }
  })

  it('a fila de não atribuídas é idempotente pelo id do provedor e guarda a atribuição inteira', () => {
    expect(uniqueColumnSets(conversationUnassigned)).toContainEqual(['company_id', 'channel', 'provider_message_id'])
    expect(checkNames(conversationUnassigned)).toContain('unassigned_assignment_check')
  })

  it('nenhuma coluna, tabela, índice ou CHECK carrega vocabulário de produto', () => {
    for (const table of Object.values(MODULE_TABLES)) {
      const config = configOf(table)
      const names = [
        config.name,
        ...config.columns.map((item) => item.name),
        ...config.indexes.map((item) => item.config.name ?? ''),
        ...config.checks.map((item) => item.name),
        ...config.uniqueConstraints.map((item) => item.getName()),
        ...config.foreignKeys.map((item) => item.getName()),
      ]
      for (const name of names) {
        for (const word of PRODUCT_WORDS) expect(name.toLowerCase()).not.toContain(word)
      }
    }
  })
})
