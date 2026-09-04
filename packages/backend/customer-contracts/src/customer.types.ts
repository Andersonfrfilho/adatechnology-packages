/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O cliente: a pessoa do outro lado da conversa.
 *
 * Deliberadamente distinto do `user` do `user-module`: aquele é identidade de LOGIN, com e-mail e
 * senha; este é identidade de COMPRA, com o número de WhatsApp como chave. Às vezes são a mesma
 * pessoa, e aí `externalUserId` liga os dois — mas a maioria dos clientes nunca terá login.
 */

/** Telefone. Uma pessoa tem vários; qual é o do WhatsApp é atributo DELE, não do cliente. */
export type CustomerPhone = {
  readonly id: string
  /** Só dígitos, sem máscara: `5516993056772`. */
  readonly number: string
  readonly label?: string
  /**
   * O número por onde a conversa chega. No máximo um por cliente, e único por empresa — é como o
   * fluxo descobre de quem é a mensagem.
   */
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

/**
 * Documento do cliente. O `name` é a chave que o produto conhece (`cpf`), e é IMUTÁVEL: ele indexa
 * o histórico de todo mundo, e renomear órfãna os dados existentes.
 */
export type CustomerDocument = {
  readonly name: string
  readonly label: string
  readonly value: string
  /** Resultado da última validação, quando houve. Ausente = nunca foi validado. */
  readonly valid?: boolean
  readonly required?: boolean
}

export type Customer = {
  readonly id: string
  /** `undefined` em single-tenant; a empresa dona da linha em multi. */
  readonly companyId?: string
  readonly name?: string
  readonly email?: string
  readonly birthDate?: string
  readonly phones: readonly CustomerPhone[]
  readonly addresses: readonly CustomerAddress[]
  readonly documents: readonly CustomerDocument[]
  /** Campos customizados, validados contra o catálogo da instalação. */
  readonly attributes: Readonly<Record<string, unknown>>
  /** Vínculo com o `user-module`, quando o produto tem login e a pessoa se cadastrou. */
  readonly externalUserId?: string
  readonly createdAt: Date
  readonly updatedAt: Date
  /** Presente = excluído logicamente, quando o host liga `softDelete`. */
  readonly deletedAt?: Date
}

export type PaginatedCustomers = {
  readonly data: readonly Customer[]
  readonly pagination: {
    readonly total: number
    readonly page: number
    readonly perPage: number
  }
}
