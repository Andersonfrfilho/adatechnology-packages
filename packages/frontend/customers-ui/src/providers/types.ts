/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O contrato que o produto hospedeiro implementa. O pacote não sabe qual cliente HTTP existe do
 * outro lado, nem se a rota é `/v1/customers` — o host injeta, e é ele que carrega o token.
 *
 * Os tipos são declarados aqui e não importados de `customer-contracts` de propósito: este pacote
 * é frontend e não deve arrastar Zod nem Drizzle para o bundle do navegador. O que casa os dois é
 * o teste de contrato do produto que adota, não uma dependência.
 */

export type CustomerPhone = {
  readonly id: string
  readonly number: string
  readonly label?: string
  readonly isWhatsApp: boolean
  readonly isPrimary: boolean
}

export type CustomerAddress = {
  readonly id: string
  readonly label?: string
  readonly zipCode?: string
  readonly street?: string
  readonly number?: string
  readonly complement?: string
  readonly district?: string
  readonly city?: string
  readonly state?: string
  readonly isPrimary: boolean
}

export type CustomerDocument = {
  readonly id: string
  readonly name: string
  readonly value: string
  readonly valid?: boolean
}

export type Customer = {
  readonly id: string
  readonly name?: string
  readonly email?: string
  readonly birthDate?: string
  readonly phones: readonly CustomerPhone[]
  readonly addresses: readonly CustomerAddress[]
  readonly documents: readonly CustomerDocument[]
  readonly attributes: Readonly<Record<string, unknown>>
  readonly createdAt: string | Date
  readonly updatedAt: string | Date
}

/** A LISTA não traz documento nem endereço: são N clientes, e a coluna quase nunca é lida. */
export type CustomerListItem = {
  readonly id: string
  readonly name?: string | null
  readonly email?: string | null
  readonly createdAt: string | Date
}

export const FIELD_TYPE = {
  TEXT: 'text',
  NUMBER: 'number',
  MONEY: 'money',
  DATE: 'date',
  BOOLEAN: 'boolean',
  SELECT: 'select',
} as const
export type FieldType = (typeof FIELD_TYPE)[keyof typeof FIELD_TYPE]

export type FieldDefinition = {
  readonly name: string
  readonly label: string
  readonly type: FieldType
  readonly required: boolean
  readonly options?: readonly { readonly value: string; readonly label: string }[]
  readonly filterable?: boolean
  readonly encrypted?: boolean
}

export type DocumentDefinition = {
  readonly name: string
  readonly label: string
  readonly required: boolean
  readonly validator: string
  /** Máscara de exibição e de digitação. Ausente = o valor sai como foi guardado. */
  readonly mask?: string
}

export type CustomerSettings = {
  readonly maskPhoneInList: boolean
  readonly documentCatalog: readonly DocumentDefinition[]
  readonly fieldCatalog: readonly FieldDefinition[]
  readonly updatedAt: string | Date
}

export type PaginatedCustomers = {
  readonly data: readonly CustomerListItem[]
  readonly pagination: { readonly total: number; readonly page: number; readonly perPage: number }
  readonly maskPhoneInList: boolean
}

export type CustomersApi = {
  listCustomers(params?: { page?: number; perPage?: number; search?: string }): Promise<PaginatedCustomers>
  getCustomer(id: string): Promise<Customer>
  getSettings(): Promise<CustomerSettings>

  /**
   * Capacidade por ausência. Produto que só LÊ o cadastro — o site da loja, que mostra a ficha do
   * próprio cliente — não implementa estas, e a tela não desenha botão que sempre falharia.
   */
  createCustomer?(input: CreateCustomerInput): Promise<{ readonly id: string }>
  updateCustomer?(id: string, input: UpdateCustomerInput): Promise<void>
  setDocument?(id: string, document: { readonly name: string; readonly value: string }): Promise<void>
  addAddress?(id: string, address: AddressInput): Promise<CustomerAddress>
  updateAddress?(id: string, addressId: string, address: AddressInput): Promise<CustomerAddress>
  removeAddress?(id: string, addressId: string): Promise<void>
  /** Só quem tem `customers:admin`. Ausente = a página de configuração é somente leitura. */
  updateSettings?(input: UpdateSettingsInput): Promise<CustomerSettings>
}

export type AddressInput = Omit<CustomerAddress, 'id' | 'isPrimary'> & { readonly isPrimary?: boolean }

export type CreateCustomerInput = {
  readonly name?: string
  readonly email?: string
  readonly birthDate?: string
  readonly phones?: readonly { readonly number: string; readonly label?: string; readonly isWhatsApp?: boolean }[]
  readonly addresses?: readonly AddressInput[]
  readonly documents?: readonly { readonly name: string; readonly value: string }[]
  readonly attributes?: Readonly<Record<string, unknown>>
}

export type UpdateCustomerInput = {
  readonly name?: string
  readonly email?: string
  readonly birthDate?: string
  readonly attributes?: Readonly<Record<string, unknown>>
}

export type UpdateSettingsInput = {
  readonly maskPhoneInList: boolean
  readonly documentCatalog: readonly DocumentDefinition[]
  readonly fieldCatalog: readonly FieldDefinition[]
}
