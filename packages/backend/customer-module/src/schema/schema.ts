/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Schema próprio (`pgSchema('customer')`), como o `user-module` e o `notification-module`: o host
 * nunca versiona estas tabelas, e um upgrade do pacote não parece migration do produto.
 *
 * Telefone, documento e endereço são TABELAS. A forma deles é conhecida, e forma conhecida é coluna
 * — dá índice de verdade, constraint de verdade e integridade referencial. Em jsonb sobra só o
 * campo customizado, cuja forma a instalação declara em execução.
 */

import { boolean, date, index, jsonb, pgSchema, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const customerSchema = pgSchema('customer')

export const customers = customerSchema.table(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** `null` em single-tenant. É a empresa dona da linha em multi. */
    companyId: uuid('company_id'),
    name: varchar('name', { length: 255 }),
    email: varchar('email', { length: 255 }),
    birthDate: date('birth_date'),
    /** Campos customizados, validados contra o catálogo da instalação. */
    attributes: jsonb('attributes').notNull().default({}),
    /** Vínculo com o `user-module`, quando a pessoa também tem login. Sem FK: outro schema, outro journal. */
    externalUserId: uuid('external_user_id'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Ordenação e listagem. Parcial: o índice fica do tamanho do que a tela realmente mostra.
    index('idx_customers_company_name')
      .on(table.companyId, table.name)
      .where(sql`${table.deletedAt} is null`),
    // Igualdade em QUALQUER chave de `attributes`, inclusive nas que ainda não existem.
    index('idx_customers_attributes').using('gin', table.attributes.op('jsonb_path_ops')),
    // Busca parcial por nome: `ilike '%x%'` não usa B-tree, o curinga à esquerda impede.
    index('idx_customers_name_trgm').using('gin', sql`${table.name} gin_trgm_ops`),
    uniqueIndex('idx_customers_external_user')
      .on(table.externalUserId)
      .where(sql`${table.externalUserId} is not null`),
  ],
)

export const customerPhones = customerSchema.table(
  'customer_phones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    /** Denormalizado do cliente SÓ para o índice único poder ser por empresa. Nunca lido como fonte. */
    companyId: uuid('company_id'),
    /** Dígitos crus, sem máscara. */
    number: varchar('number', { length: 20 }).notNull(),
    label: varchar('label', { length: 60 }),
    isWhatsApp: boolean('is_whatsapp').notNull().default(false),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    /*
     * A identidade da conversa, e é ela que sustenta o caminho quente.
     *
     * PARCIAL: dois clientes podem dividir o telefone fixo de casa; nenhum divide o do WhatsApp. Se
     * dividissem, a próxima mensagem cairia na ficha errada — sem erro, só resposta para a pessoa
     * errada. E no BANCO, porque entre consultar e gravar cabe outra escrita.
     *
     * ⚠️ A declaração ABAIXO ESTÁ INCOMPLETA, e de propósito: falta `NULLS NOT DISTINCT`, que o
     * DSL do Drizzle não expressa em índice (só em constraint, e constraint não pode ser parcial).
     *
     * Sem essa cláusula o índice existe, parece certo e NÃO IMPEDE NADA em single-tenant, onde
     * `companyId` é nulo — o Postgres trata nulos como distintos. A migration em `migrations/` é a
     * fonte da verdade e a carrega; `whatsAppUniqueness.test.ts` verifica o COMPORTAMENTO no banco,
     * para a divergência não poder passar calada.
     */
    uniqueIndex('idx_customer_phones_whatsapp')
      .on(table.companyId, table.number)
      .where(sql`${table.isWhatsApp}`),
    index('idx_customer_phones_customer').on(table.customerId),
    index('idx_customer_phones_number_trgm').using('gin', sql`${table.number} gin_trgm_ops`),
  ],
)

export const customerDocuments = customerSchema.table(
  'customer_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id'),
    /** A chave do catálogo: 'cpf', 'cnpj'. Imutável. */
    name: varchar('name', { length: 40 }).notNull(),
    /** Cifrado em repouso quando o catálogo declarar. */
    value: text('value').notNull(),
    /**
     * HMAC do valor normalizado, presente só quando o valor é cifrado.
     *
     * É o que torna documento cifrado pesquisável: o texto cifrado difere a cada gravação, a
     * impressão não. Sem ela, "achar o cliente pelo CPF" exigiria decifrar a base inteira.
     */
    fingerprint: varchar('fingerprint', { length: 64 }),
    valid: boolean('valid'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_customer_documents_customer').on(table.customerId),
    /*
     * Um documento de cada tipo por cliente. É o que o `onConflictDoUpdate` do `SetDocument`
     * ancora: sem esta constraint, regravar o CPF criaria uma segunda linha em vez de atualizar a
     * primeira — e a busca passaria a achar duas, com valores diferentes.
     */
    uniqueIndex('idx_customer_documents_identity').on(table.customerId, table.name),
    // O índice cego: busca por igualdade sobre dado cifrado.
    index('idx_customer_documents_fingerprint')
      .on(table.name, table.fingerprint)
      .where(sql`${table.fingerprint} is not null`),
    // Documento em claro busca pelo próprio valor.
    index('idx_customer_documents_value')
      .on(table.name, table.value)
      .where(sql`${table.fingerprint} is null`),
  ],
)

export const customerAddresses = customerSchema.table(
  'customer_addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 60 }),
    zipCode: varchar('zip_code', { length: 9 }),
    street: varchar('street', { length: 255 }),
    number: varchar('number', { length: 20 }),
    complement: varchar('complement', { length: 120 }),
    district: varchar('district', { length: 120 }),
    city: varchar('city', { length: 120 }),
    state: varchar('state', { length: 2 }),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_customer_addresses_customer').on(table.customerId)],
)

export const customerSettings = customerSchema.table(
  'settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id'),
    maskPhoneInList: boolean('mask_phone_in_list').notNull().default(true),
    documentCatalog: jsonb('document_catalog').notNull().default([]),
    fieldCatalog: jsonb('field_catalog').notNull().default([]),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    updatedByUserId: uuid('updated_by_user_id'),
  },
  (table) => [
    /*
     * Mesma incompletude do índice de telefone, e pela mesma razão: `NULLS NOT DISTINCT` vive na
     * migration. Sem ela, a instalação single-tenant teria N configurações concorrendo e nenhuma
     * sendo a verdadeira.
     */
    uniqueIndex('idx_customer_settings_company').on(table.companyId),
  ],
)

export type CustomerRow = typeof customers.$inferSelect
export type NewCustomerRow = typeof customers.$inferInsert
export type CustomerPhoneRow = typeof customerPhones.$inferSelect
export type CustomerDocumentRow = typeof customerDocuments.$inferSelect
export type CustomerAddressRow = typeof customerAddresses.$inferSelect
export type CustomerSettingsRow = typeof customerSettings.$inferSelect
