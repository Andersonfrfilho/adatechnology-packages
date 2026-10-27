/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Schemas com `.strict()` ou strip automático devem rejeitar `companyId` e `company_id` em qualquer
 * corpo de requisição. O tenant é sempre derivado do contexto autenticado, nunca do payload. O teste
 * afirma em nível de tipo que campos obrigatórios não degradam para `undefined` sem strict (RNF3).
 */

import { describe, expect, it } from 'bun:test'

import {
  openConversationBodySchema,
  sendMessageBodySchema,
  markConversationReadBodySchema,
  quickReplyBodySchema,
  type SendMessageBody,
  type MarkConversationReadBody,
  type QuickReplyBody,
} from './requestSchemas'

type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

function assertExact<T extends true>(): void {
  void 0 as unknown as T
}

describe('declarações do contracts sob strict', () => {
  it('mantém campos obrigatórios sem undefined', () => {
    assertExact<Exact<SendMessageBody['bodyText'], string>>()
    assertExact<Exact<SendMessageBody['channel'], string>>()
    assertExact<Exact<MarkConversationReadBody['lastReadMessageId'], string>>()
    assertExact<Exact<QuickReplyBody['audience'], string>>()
    assertExact<Exact<QuickReplyBody['bodyText'], string>>()

    expect(true).toBe(true)
  })

  it('openConversationBodySchema não aceita companyId', () => {
    const result = openConversationBodySchema.safeParse({
      subjectType: 'lead',
      subjectId: '123e4567-e89b-12d3-a456-426614174000',
      participants: [
        {
          channel: 'email',
          identifier: 'test@example.com',
        },
      ],
      companyId: 'tentativa-de-injecao',
    })

    expect(!('companyId' in (result.success ? result.data : {}))).toBe(true)
  })

  it('openConversationBodySchema não aceita company_id', () => {
    const result = openConversationBodySchema.safeParse({
      subjectType: 'lead',
      subjectId: '123e4567-e89b-12d3-a456-426614174000',
      participants: [
        {
          channel: 'email',
          identifier: 'test@example.com',
        },
      ],
      company_id: 'tentativa-de-injecao',
    })

    expect(!('company_id' in (result.success ? result.data : {}))).toBe(true)
  })

  it('sendMessageBodySchema não aceita companyId', () => {
    const result = sendMessageBodySchema.safeParse({
      channel: 'email',
      bodyText: 'Olá',
      companyId: 'tentativa-de-injecao',
    })

    expect(!('companyId' in (result.success ? result.data : {}))).toBe(true)
  })

  it('sendMessageBodySchema não aceita company_id', () => {
    const result = sendMessageBodySchema.safeParse({
      channel: 'email',
      bodyText: 'Olá',
      company_id: 'tentativa-de-injecao',
    })

    expect(!('company_id' in (result.success ? result.data : {}))).toBe(true)
  })

  it('markConversationReadBodySchema não aceita companyId', () => {
    const result = markConversationReadBodySchema.safeParse({
      lastReadMessageId: '123e4567-e89b-12d3-a456-426614174000',
      companyId: 'tentativa-de-injecao',
    })

    expect(!('companyId' in (result.success ? result.data : {}))).toBe(true)
  })

  it('markConversationReadBodySchema não aceita company_id', () => {
    const result = markConversationReadBodySchema.safeParse({
      lastReadMessageId: '123e4567-e89b-12d3-a456-426614174000',
      company_id: 'tentativa-de-injecao',
    })

    expect(!('company_id' in (result.success ? result.data : {}))).toBe(true)
  })

  it('quickReplyBodySchema não aceita companyId', () => {
    const result = quickReplyBodySchema.safeParse({
      audience: 'all',
      bodyText: 'Resposta rápida',
      companyId: 'tentativa-de-injecao',
    })

    expect(!('companyId' in (result.success ? result.data : {}))).toBe(true)
  })

  it('quickReplyBodySchema não aceita company_id', () => {
    const result = quickReplyBodySchema.safeParse({
      audience: 'all',
      bodyText: 'Resposta rápida',
      company_id: 'tentativa-de-injecao',
    })

    expect(!('company_id' in (result.success ? result.data : {}))).toBe(true)
  })
})
