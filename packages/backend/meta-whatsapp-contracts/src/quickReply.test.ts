import { describe, expect, it } from 'bun:test'

import { QuickReplyShortcutTakenError } from './errors'
import {
  QUICK_REPLY_ERROR_CODES,
  QUICK_REPLY_LIMITS,
  listWhatsAppQuickRepliesQuerySchema,
  whatsAppQuickReplyInputSchema,
} from './quickReply'

const valid = { title: 'Boas-vindas', shortcut: 'ola', body: 'Olá, {{nome}}!' }

describe('whatsAppQuickReplyInputSchema', () => {
  it('aceita uma resposta válida e apara título e texto', () => {
    const parsed = whatsAppQuickReplyInputSchema.parse({ ...valid, title: '  Boas-vindas ', body: ' Olá ' })
    expect(parsed.title).toBe('Boas-vindas')
    expect(parsed.body).toBe('Olá')
  })

  it('aceita os limites exatos', () => {
    const result = whatsAppQuickReplyInputSchema.safeParse({
      title: 'a'.repeat(QUICK_REPLY_LIMITS.TITLE_MAX_LENGTH),
      shortcut: 'b'.repeat(QUICK_REPLY_LIMITS.SHORTCUT_MAX_LENGTH),
      body: 'c'.repeat(QUICK_REPLY_LIMITS.BODY_MAX_LENGTH),
    })
    expect(result.success).toBe(true)
  })

  it('recusa título, atalho e texto fora do limite, todos de uma vez', () => {
    const result = whatsAppQuickReplyInputSchema.safeParse({
      title: 'a'.repeat(QUICK_REPLY_LIMITS.TITLE_MAX_LENGTH + 1),
      shortcut: 'Com Espaço',
      body: ' ',
    })
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error.issues.map((issue) => issue.path[0]).sort()).toEqual(['body', 'shortcut', 'title'])
  })

  it('recusa atalho com maiúscula, acento ou mais de 20 caracteres', () => {
    for (const shortcut of ['Ola', 'olá', 'a'.repeat(21), '']) {
      expect(whatsAppQuickReplyInputSchema.safeParse({ ...valid, shortcut }).success).toBe(false)
    }
  })

  it('recusa ordem negativa ou fracionária', () => {
    expect(whatsAppQuickReplyInputSchema.safeParse({ ...valid, sortOrder: -1 }).success).toBe(false)
    expect(whatsAppQuickReplyInputSchema.safeParse({ ...valid, sortOrder: 1.5 }).success).toBe(false)
  })
})

describe('listWhatsAppQuickRepliesQuerySchema', () => {
  it('a busca é opcional e limitada', () => {
    expect(listWhatsAppQuickRepliesQuerySchema.parse({})).toEqual({})
    expect(listWhatsAppQuickRepliesQuerySchema.safeParse({ search: 'x'.repeat(101) }).success).toBe(false)
  })
})

describe('erros', () => {
  it('atalho em uso é 409 com o código que o conversations-ui reconhece', () => {
    const error = new QuickReplyShortcutTakenError('ola')
    expect(error.statusCode).toBe(409)
    expect(error.code).toBe(QUICK_REPLY_ERROR_CODES.SHORTCUT_TAKEN)
    expect(error.code).toBe('QUICK_REPLY_SHORTCUT_TAKEN')
  })
})
