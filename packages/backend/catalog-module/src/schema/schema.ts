/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { sql } from 'drizzle-orm'
import { boolean, index, integer, pgSchema, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

// Schema Postgres dedicado — o módulo nunca escreve no `public` do host (regra §3).
export const catalogSchema = pgSchema('catalog')

// varchar em vez de ENUM nativo (`code-standart.md` §8); os valores espelham os `const object` do
// `@adatechnology/catalog-contracts`, sem o schema importar o runtime dele.
const COMPANY_ID = uuid('company_id').notNull()
const SYNC_STATUS = varchar('sync_status', { length: 12 })
const SYNC_ERROR = varchar('sync_error', { length: 512 })

export const catalogs = catalogSchema.table(
  'catalogs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: COMPANY_ID,
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    // Na Meta, um catálogo do host vira um *product set* dentro do catálogo da conta.
    externalId: varchar('external_id', { length: 128 }),
    syncStatus: SYNC_STATUS,
    syncError: SYNC_ERROR,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Parcial: nome liberado de novo depois do soft delete. Sem o `where`, um catálogo excluído
    // bloquearia para sempre a recriação com o mesmo nome.
    uniqueIndex('idx_catalogs_company_name')
      .on(table.companyId, table.name)
      .where(sql`${table.deletedAt} is null`),
    index('idx_catalogs_company_active').on(table.companyId, table.active, table.sortOrder),
  ],
)

export const sections = catalogSchema.table(
  'sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: COMPANY_ID,
    name: varchar('name', { length: 80 }).notNull(),
    // Nullable de propósito: em restaurante a seção é o posto de produção (cozinha, bar, chapa) e
    // o mesmo posto atende itens de categorias diferentes. Amarrar a catálogo obrigaria a
    // duplicar cada seção por categoria só para exibi-la.
    catalogId: uuid('catalog_id').references(() => catalogs.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('idx_sections_company_catalog_name').on(table.companyId, table.catalogId, table.name)],
)

export const products = catalogSchema.table(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: COMPANY_ID,
    // Nullable: produto sem catálogo é rascunho válido — cadastrado pelo leitor de código de
    // barras antes de ser classificado. `NOT NULL` forçaria um catálogo "Sem categoria" fantasma.
    catalogId: uuid('catalog_id').references(() => catalogs.id, { onDelete: 'set null' }),
    sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 160 }).notNull(),
    description: text('description'),
    // Centavos inteiros — `numeric` seria mais correto para dinheiro em geral, mas preço de
    // varejo não tem fração de centavo e `integer` remove a classe de bug de ponto flutuante.
    priceInCents: integer('price_in_cents').notNull(),
    // Margem: nunca sai na projeção destinada ao cliente final (ver ProductRepository).
    costPriceInCents: integer('cost_price_in_cents'),
    unit: varchar('unit', { length: 16 }),
    // Tamanho da embalagem como está no rótulo ("500g", "fardo 12un"). Texto, e não número, porque
    // "cx 24x350ml" não tem forma numérica única e quem confere a sacola lê o rótulo.
    unitSize: varchar('unit_size', { length: 40 }),
    brand: varchar('brand', { length: 80 }),
    // Endereço de prateleira, não agrupamento de catálogo (isso é `sectionId`). Vazio na maioria
    // dos itens: nenhuma loja mapeia o catálogo inteiro de uma vez.
    aisle: varchar('aisle', { length: 60 }),
    // Como o cliente chama o produto. Array em vez de tabela: a lista é curta, sempre lida junto
    // com o produto e nunca consultada sozinha — uma tabela só acrescentaria um join por item.
    aliases: text('aliases')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    barcode: varchar('barcode', { length: 14 }),
    imageUrl: text('image_url'),
    // Separado da URL porque ela pode ser assinada e expirar; a chave é o que permite reemitir
    // ou apagar o objeto no bucket.
    imageStorageKey: text('image_storage_key'),
    // `null` = estoque não controlado; a disponibilidade vira decisão manual.
    inventory: integer('inventory'),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    availability: varchar('availability', { length: 16 }).notNull().default('in stock'),
    preparationTimeMinutes: integer('preparation_time_minutes'),
    preparationInstructions: text('preparation_instructions'),
    externalId: varchar('external_id', { length: 128 }),
    syncStatus: SYNC_STATUS,
    syncError: SYNC_ERROR,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Único por empresa e só quando há código — dois GTIN iguais quebram a busca por leitor, mas
    // a maioria dos itens de restaurante não tem código nenhum.
    uniqueIndex('idx_products_company_barcode')
      .on(table.companyId, table.barcode)
      .where(sql`${table.barcode} is not null and ${table.deletedAt} is null`),
    index('idx_products_company_catalog').on(table.companyId, table.catalogId, table.sortOrder),
    // Alimenta o filtro "o que ainda não subiu para a Meta" e a varredura do RetryFailedSyncs.
    index('idx_products_company_sync').on(table.companyId, table.syncStatus),
    // GIN + trigramas para a busca por texto do ProductList. Numa base de supermercado
    // (dezenas de milhares de SKUs), `ILIKE '%termo%'` sem este índice varre a tabela inteira —
    // e btree não serve, porque não atende curinga no início do padrão.
    // A extensão `pg_trgm` é criada na migration; sem ela o índice não pode ser construído.
    index('idx_products_name_trgm').using('gin', sql`${table.name} gin_trgm_ops`),
    // A busca casa nome, marca e apelido na mesma consulta; sem estes dois, acrescentar marca e
    // apelido ao `where` transformaria a busca indexada numa varredura de tabela.
    index('idx_products_brand_trgm').using('gin', sql`${table.brand} gin_trgm_ops`),
    // `array_ops`, e não trigrama: o apelido é casado inteiro (`aliases && ARRAY[...]`), porque
    // apelido é o termo curto que o cliente digita — casar pedaço dele traria o catálogo todo.
    index('idx_products_aliases_gin').using('gin', table.aliases),
  ],
)

export type CatalogRow = typeof catalogs.$inferSelect
export type NewCatalogRow = typeof catalogs.$inferInsert

export type SectionRow = typeof sections.$inferSelect
export type NewSectionRow = typeof sections.$inferInsert

export type ProductRow = typeof products.$inferSelect
export type NewProductRow = typeof products.$inferInsert
