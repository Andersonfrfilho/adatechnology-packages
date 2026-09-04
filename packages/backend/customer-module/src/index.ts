/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export * from './schema'
export { runCustomerMigrations, customerMigrationsFolder, CUSTOMER_MIGRATIONS_TABLE } from './runMigrations'
export type { RunCustomerMigrationsParams } from './runMigrations'
export type { CustomerDatabase } from './database.types'
export { CustomerRepository } from './repositories/CustomerRepository'
export type { CustomerAggregate, ListParams } from './repositories/CustomerRepository'
export { UpsertByPhoneUseCase, SetWhatsAppPhoneUseCase } from './use-cases/UpsertByPhone.use-case'
export type { UpsertByPhoneParams } from './use-cases/UpsertByPhone.use-case'
export {
  assertCatalogChangeIsSafe,
  assertDocumentCatalogChangeIsSafe,
  diffFilterableFields,
  castForFieldType,
} from './use-cases/validateCatalogChange'
export { validateAttributes } from './use-cases/validateAttributes'
export { normalizePhone, normalizeDocument, toSearchPattern } from './shared/normalize'
export { resolveScopeCompanyId } from './shared/tenancy'
