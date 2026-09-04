/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const CUSTOMER_ERROR_CODE = {
  NOT_FOUND: 'CUSTOMER_NOT_FOUND',
  WHATSAPP_PHONE_TAKEN: 'CUSTOMER_WHATSAPP_PHONE_TAKEN',
  PHONE_NOT_FOUND: 'CUSTOMER_PHONE_NOT_FOUND',
  LAST_WHATSAPP_PHONE: 'CUSTOMER_LAST_WHATSAPP_PHONE',
  UNKNOWN_FIELD: 'CUSTOMER_UNKNOWN_FIELD',
  INVALID_FIELD_VALUE: 'CUSTOMER_INVALID_FIELD_VALUE',
  FIELD_NAME_IMMUTABLE: 'CUSTOMER_FIELD_NAME_IMMUTABLE',
  FIELD_TYPE_IMMUTABLE: 'CUSTOMER_FIELD_TYPE_IMMUTABLE',
  ENCRYPTED_FIELD_REMOVAL: 'CUSTOMER_ENCRYPTED_FIELD_REMOVAL',
  TOO_MANY_FILTERABLE_FIELDS: 'CUSTOMER_TOO_MANY_FILTERABLE_FIELDS',
  CONFIG_MISSING: 'CUSTOMER_CONFIG_MISSING',
} as const

export type CustomerErrorCode = (typeof CUSTOMER_ERROR_CODE)[keyof typeof CUSTOMER_ERROR_CODE]

export class CustomerError extends Error {
  constructor(
    message: string,
    readonly code: CustomerErrorCode,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class CustomerNotFoundError extends CustomerError {
  constructor() {
    super('Cliente não encontrado.', CUSTOMER_ERROR_CODE.NOT_FOUND)
  }
}

/**
 * O número do WhatsApp já é de outro cliente.
 *
 * A constraint do banco é quem decide isto, não uma checagem anterior: entre consultar e gravar cabe
 * outra escrita, e duas mensagens do mesmo número chegando juntas é exatamente o caso.
 */
export class WhatsAppPhoneTakenError extends CustomerError {
  constructor() {
    super('Este número de WhatsApp já pertence a outro cliente.', CUSTOMER_ERROR_CODE.WHATSAPP_PHONE_TAKEN)
  }
}

/** Sem número de WhatsApp, a próxima mensagem da pessoa não encontra a ficha dela. */
export class LastWhatsAppPhoneError extends CustomerError {
  constructor() {
    super('O cliente precisa de um número de WhatsApp.', CUSTOMER_ERROR_CODE.LAST_WHATSAPP_PHONE)
  }
}

/** Campo fora do catálogo. Aceitar criaria dado que nenhuma tela sabe desenhar. */
export class UnknownFieldError extends CustomerError {
  constructor(name: string) {
    super('Campo não declarado no catálogo.', CUSTOMER_ERROR_CODE.UNKNOWN_FIELD, { name })
  }
}

export class InvalidFieldValueError extends CustomerError {
  constructor(name: string, reason: string) {
    super('Valor inválido para o campo.', CUSTOMER_ERROR_CODE.INVALID_FIELD_VALUE, { name, reason })
  }
}

/** `name` indexa o histórico de todo cliente; renomear órfãna os dados já gravados. */
export class FieldNameImmutableError extends CustomerError {
  constructor(name: string) {
    super('O nome de um campo não pode mudar depois de criado.', CUSTOMER_ERROR_CODE.FIELD_NAME_IMMUTABLE, { name })
  }
}

/** Já existe valor gravado na forma antiga; converter em massa é migration, não clique. */
export class FieldTypeImmutableError extends CustomerError {
  constructor(name: string) {
    super('O tipo de um campo em uso não pode mudar.', CUSTOMER_ERROR_CODE.FIELD_TYPE_IMMUTABLE, { name })
  }
}

/** Sumiria a definição de um dado que continua no banco, cifrado, sem ninguém saber o que é. */
export class EncryptedFieldRemovalError extends CustomerError {
  constructor(name: string) {
    super('Campo cifrado não pode sair do catálogo.', CUSTOMER_ERROR_CODE.ENCRYPTED_FIELD_REMOVAL, { name })
  }
}
