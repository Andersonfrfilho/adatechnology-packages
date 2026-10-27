/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Validação de fronteira. O que passa daqui já está na forma que o módulo espera.
 */

import { z } from 'zod'

import { DOCUMENT_VALIDATOR, FIELD_NAME_PATTERN, FIELD_TYPE, MAX_FILTERABLE_FIELDS } from './settings.types'

/** Só dígitos: `(16) 99305-6772` e `5516993056772` são o mesmo telefone, e o banco guarda um só. */
/**
 * Aceita o que uma PESSOA digita — `(16) 99305-6772` — e entrega dígitos.
 *
 * Recusar a máscara aqui obrigaria cada tela a limpar antes de enviar, e a que esquecesse mandaria
 * o operador corrigir um telefone que estava certo. A normalização é uma só, e é esta.
 */
export const phoneNumberSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((digits) => /^\d{10,15}$/.test(digits), 'Telefone deve ter DDD e de 10 a 15 dígitos')

export const customerPhoneInputSchema = z.object({
  number: phoneNumberSchema,
  label: z.string().min(1).max(60).optional(),
  isWhatsApp: z.boolean().default(false),
  /** Ausente ≠ `false`: sem ninguém marcado, o primeiro da lista assume. */
  isPrimary: z.boolean().optional(),
})

export const customerAddressInputSchema = z.object({
  label: z.string().min(1).max(60).optional(),
  zipCode: z
    .string()
    .regex(/^\d{5}-?\d{3}$/, 'CEP deve ter 8 dígitos')
    .optional(),
  street: z.string().min(1).max(255).optional(),
  number: z.string().min(1).max(20).optional(),
  complement: z.string().min(1).max(120).optional(),
  district: z.string().min(1).max(120).optional(),
  city: z.string().min(1).max(120).optional(),
  state: z.string().length(2).optional(),
  /** Ausente ≠ `false`: sem ninguém marcado, o primeiro da lista assume. */
  isPrimary: z.boolean().optional(),
})

/**
 * `name` com a MESMA forma do campo customizado: documento também é chave dentro de jsonb, e o dia
 * em que alguém indexar por documento a trava precisa já estar aqui.
 */
export const documentDefinitionSchema = z.object({
  name: z.string().regex(FIELD_NAME_PATTERN, 'Use apenas letras minúsculas, números e _'),
  label: z.string().min(1).max(60),
  required: z.boolean().default(false),
  mask: z.string().min(1).max(40).optional(),
  validator: z.nativeEnum(DOCUMENT_VALIDATOR).default(DOCUMENT_VALIDATOR.NONE),
})

export const fieldDefinitionSchema = z
  .object({
    name: z.string().regex(FIELD_NAME_PATTERN, 'Use apenas letras minúsculas, números e _'),
    label: z.string().min(1).max(60),
    type: z.nativeEnum(FIELD_TYPE),
    options: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) })).optional(),
    required: z.boolean().default(false),
    encrypted: z.boolean().optional(),
    searchable: z.boolean().optional(),
    filterable: z.boolean().optional(),
  })
  /* `select` sem opção é campo que a tela desenha vazio e ninguém consegue preencher. */
  .refine((field) => field.type !== FIELD_TYPE.SELECT || (field.options?.length ?? 0) > 0, {
    message: 'Campo do tipo `select` precisa de ao menos uma opção',
    path: ['options'],
  })
  /*
   * Cifrado e filtrável não convivem: o índice de expressão compararia texto cifrado, que difere a
   * cada gravação. O índice existiria e nunca acharia nada — pior que não existir.
   */
  .refine((field) => !(field.encrypted && field.filterable), {
    message: 'Campo cifrado não pode ser filtrável — o índice compararia texto cifrado',
    path: ['filterable'],
  })

export const updateSettingsSchema = z
  .object({
    maskPhoneInList: z.boolean(),
    documentCatalog: z.array(documentDefinitionSchema),
    fieldCatalog: z.array(fieldDefinitionSchema),
  })
  .refine((settings) => settings.fieldCatalog.filter((field) => field.filterable).length <= MAX_FILTERABLE_FIELDS, {
    message: `No máximo ${MAX_FILTERABLE_FIELDS} campos filtráveis — cada um cobra escrita a cada mensagem recebida`,
    path: ['fieldCatalog'],
  })
  /* Chave duplicada faria a segunda definição sobrescrever a primeira em silêncio. */
  .refine((settings) => new Set(settings.fieldCatalog.map((f) => f.name)).size === settings.fieldCatalog.length, {
    message: 'Há campos com o mesmo `name`',
    path: ['fieldCatalog'],
  })
  .refine((settings) => new Set(settings.documentCatalog.map((d) => d.name)).size === settings.documentCatalog.length, {
    message: 'Há documentos com o mesmo `name`',
    path: ['documentCatalog'],
  })

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  birthDate: z.string().date().optional(),
  phones: z.array(customerPhoneInputSchema).default([]),
  addresses: z.array(customerAddressInputSchema).default([]),
  documents: z.array(z.object({ name: z.string().min(1), value: z.string().min(1) })).default([]),
  attributes: z.record(z.unknown()).default({}),
})

export const listCustomersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().min(1).max(120).optional(),
})

export type CustomerPhoneInput = z.infer<typeof customerPhoneInputSchema>
export type CustomerAddressInput = z.infer<typeof customerAddressInputSchema>
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type ListCustomersInput = z.infer<typeof listCustomersSchema>
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>
