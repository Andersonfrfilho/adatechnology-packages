/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export {
  CustomersProvider,
  useCustomersApi,
  useCustomerSettings,
  useCustomersCapabilities,
} from './providers/CustomersProvider'
export type { CustomersProviderProps } from './providers/CustomersProvider'

export { CustomerList } from './CustomerList'
export type { CustomerListProps } from './CustomerList'

export { CustomerDetail } from './CustomerDetail'
export type { CustomerDetailProps } from './CustomerDetail'

export { CustomerSettingsPage } from './CustomerSettingsPage'
export type { CustomerSettingsPageProps } from './CustomerSettingsPage'

export { useCustomerSearch } from './useCustomerSearch'
export type { UseCustomerSearchResult } from './useCustomerSearch'

export { formatPhone, maskPhone, applyMask, formatDate } from './lib/format'
export { inputTypeFor, parseAttribute, validateAttributes, filterableFields } from './lib/attributes'
export type { AttributeError } from './lib/attributes'
export {
  validateSettingsDraft,
  describeDestructiveChanges,
  FIELD_NAME_PATTERN,
  MAX_FILTERABLE_FIELDS,
} from './lib/settingsDraft'
export type { DraftError } from './lib/settingsDraft'

export { FIELD_TYPE } from './providers/types'
export type {
  Customer,
  CustomerListItem,
  CustomerPhone,
  CustomerAddress,
  CustomerDocument,
  CustomerSettings,
  CustomersApi,
  PaginatedCustomers,
  FieldDefinition,
  FieldType,
  DocumentDefinition,
  AddressInput,
  CreateCustomerInput,
  UpdateCustomerInput,
  UpdateSettingsInput,
} from './providers/types'
