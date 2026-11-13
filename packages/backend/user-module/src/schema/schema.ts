/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { sql } from 'drizzle-orm'
import { boolean, index, pgSchema, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

export const userSchema = pgSchema('user')

export const users = userSchema.table(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Nulo em single-tenant — ver `TenancyConfig` em `user-contracts`. O host que roda multi-tenant
    // sempre preenche; o host single-tenant nunca preenche, e o índice único abaixo trata os dois.
    companyId: varchar('company_id', { length: 64 }),
    email: varchar('email', { length: 320 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    // Nulo para usuário só-Keycloak — não existe senha local para verificar.
    passwordHash: varchar('password_hash', { length: 255 }),
    role: varchar('role', { length: 40 }).notNull(),
    providerId: varchar('provider_id', { length: 40 }).notNull().default('local'),
    // `sub` do Keycloak (ou de outro provider OIDC/OAuth2 futuro); nulo para usuário local.
    externalId: varchar('external_id', { length: 200 }),
    // Chave opaca no armazenamento do host, nunca uma URL: a URL e assinada e expira, e guardar
    // URL no banco daria uma coluna cheia de links mortos.
    avatarKey: varchar('avatar_key', { length: 512 }),
    isActive: boolean('is_active').notNull().default(true),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Dois índices parciais em vez de `NULLS NOT DISTINCT` — não depende da versão do Postgres do
    // host (`NULLS NOT DISTINCT` só existe a partir do 15) e o resultado é o mesmo: um e-mail só
    // pode existir uma vez por empresa, e uma vez sozinho quando a empresa é nula (single-tenant).
    uniqueIndex('idx_users_company_email')
      .on(table.companyId, table.email)
      .where(sql`${table.companyId} is not null and ${table.deletedAt} is null`),
    uniqueIndex('idx_users_email_single_tenant')
      .on(table.email)
      .where(sql`${table.companyId} is null and ${table.deletedAt} is null`),
    // Mesma lógica para o par (provider, externalId): usuário local nunca tem externalId, então a
    // unicidade só faz sentido quando ele existe. O par é único **por empresa**, não global — em
    // multi-tenant, o mesmo `sub` do Keycloak pode ser pessoa de duas empresas, e cada uma precisa
    // do seu próprio usuário; unicidade global faria a segunda empresa herdar a sessão da primeira.
    uniqueIndex('idx_users_company_provider_external')
      .on(table.companyId, table.providerId, table.externalId)
      .where(sql`${table.externalId} is not null and ${table.companyId} is not null`),
    uniqueIndex('idx_users_provider_external_single_tenant')
      .on(table.providerId, table.externalId)
      .where(sql`${table.externalId} is not null and ${table.companyId} is null`),
    index('idx_users_company_active').on(table.companyId, table.isActive),
  ],
)

export const passwordResetTokens = userSchema.table(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // sha256 hex do token — o valor cru nunca é persistido, só o hash comparado na confirmação.
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    requestedIp: varchar('requested_ip', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_password_reset_tokens_hash').on(table.tokenHash),
    index('idx_password_reset_tokens_user').on(table.userId),
  ],
)

export const refreshTokens = userSchema.table('refresh_tokens', {
  // PK é o próprio hash — o token cru nunca é persistido, mesmo idioma de `password_reset_tokens`.
  tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type UserRow = typeof users.$inferSelect
export type NewUserRow = typeof users.$inferInsert

export type PasswordResetTokenRow = typeof passwordResetTokens.$inferSelect
export type NewPasswordResetTokenRow = typeof passwordResetTokens.$inferInsert

export type RefreshTokenRow = typeof refreshTokens.$inferSelect
export type NewRefreshTokenRow = typeof refreshTokens.$inferInsert
