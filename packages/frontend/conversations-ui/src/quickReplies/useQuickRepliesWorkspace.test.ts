import { describe, expect, it } from 'bun:test'

import {
  insertAtCursor,
  submitQuickReply,
  validateQuickReplyInput,
  type QuickRepliesWorkspaceApi,
  type QuickRepliesWorkspaceEditing,
} from './useQuickRepliesWorkspace'
import { DEFAULT_QUICK_REPLIES_WORKSPACE_LABELS } from './labels'
import type { QuickReply } from './quickReply.types'

const LABELS = DEFAULT_QUICK_REPLIES_WORKSPACE_LABELS

const VALID_EDITING: QuickRepliesWorkspaceEditing = { id: null, title: 'Saudação', shortcut: 'ola', body: 'Olá!' }
const SAVED: QuickReply = { id: '1', title: 'Saudação', shortcut: 'ola', body: 'Olá!' }

describe('validateQuickReplyInput', () => {
  it('aceita título, atalho e corpo dentro do limite', () => {
    expect(validateQuickReplyInput({ title: 'Saudação', shortcut: 'ola', body: 'Olá!' }, LABELS)).toEqual({})
  })

  it('rejeita título vazio ou maior que 40 caracteres', () => {
    expect(validateQuickReplyInput({ title: '', shortcut: 'ola', body: 'Olá!' }, LABELS).title).toBeDefined()
    expect(
      validateQuickReplyInput({ title: 'x'.repeat(41), shortcut: 'ola', body: 'Olá!' }, LABELS).title,
    ).toBeDefined()
  })

  it('rejeita atalho com maiúscula, espaço ou acento', () => {
    expect(validateQuickReplyInput({ title: 'T', shortcut: 'Ola', body: 'B' }, LABELS).shortcut).toBeDefined()
    expect(validateQuickReplyInput({ title: 'T', shortcut: 'ol a', body: 'B' }, LABELS).shortcut).toBeDefined()
    expect(validateQuickReplyInput({ title: 'T', shortcut: 'olá', body: 'B' }, LABELS).shortcut).toBeDefined()
  })

  it('aceita atalho com hífen e número', () => {
    expect(validateQuickReplyInput({ title: 'T', shortcut: 'doc-2', body: 'B' }, LABELS).shortcut).toBeUndefined()
  })

  it('rejeita corpo vazio ou maior que 1000 caracteres', () => {
    expect(validateQuickReplyInput({ title: 'T', shortcut: 'ola', body: '' }, LABELS).body).toBeDefined()
    expect(validateQuickReplyInput({ title: 'T', shortcut: 'ola', body: 'x'.repeat(1001) }, LABELS).body).toBeDefined()
  })
})

describe('submitQuickReply', () => {
  it('cria quando id é null e chama createQuickReply', async () => {
    const api: QuickRepliesWorkspaceApi = { createQuickReply: async () => SAVED }
    const result = await submitQuickReply({ api, editing: VALID_EDITING, labels: LABELS })
    expect(result).toEqual({ outcome: 'saved', quickReply: SAVED })
  })

  it('atualiza quando há id e chama updateQuickReply com ele', async () => {
    let calledWith: string | undefined
    const api: QuickRepliesWorkspaceApi = {
      updateQuickReply: async (id) => {
        calledWith = id
        return SAVED
      },
    }
    const result = await submitQuickReply({ api, editing: { ...VALID_EDITING, id: '1' }, labels: LABELS })
    expect(result).toEqual({ outcome: 'saved', quickReply: SAVED })
    expect(calledWith).toBe('1')
  })

  it('não chama a api quando a validação falha', async () => {
    let called = false
    const api: QuickRepliesWorkspaceApi = {
      createQuickReply: async () => {
        called = true
        return SAVED
      },
    }
    const result = await submitQuickReply({ api, editing: { ...VALID_EDITING, title: '' }, labels: LABELS })
    expect(result.outcome).toBe('invalid')
    expect(called).toBe(false)
  })

  it('409 com code QUICK_REPLY_SHORTCUT_TAKEN vira erro no campo atalho', async () => {
    const api: QuickRepliesWorkspaceApi = {
      createQuickReply: async () => {
        throw { code: 'QUICK_REPLY_SHORTCUT_TAKEN' }
      },
    }
    const result = await submitQuickReply({ api, editing: VALID_EDITING, labels: LABELS })
    expect(result).toEqual({ outcome: 'rejected', fieldErrors: { shortcut: LABELS.shortcutTaken } })
  })

  it('error.details[] com vários campos aponta cada um no seu campo', async () => {
    const api: QuickRepliesWorkspaceApi = {
      createQuickReply: async () => {
        throw {
          details: [
            { field: 'title', message: 'Título repetido' },
            { field: 'shortcut', message: 'Atalho em uso' },
          ],
        }
      },
    }
    const result = await submitQuickReply({ api, editing: VALID_EDITING, labels: LABELS })
    expect(result).toEqual({
      outcome: 'rejected',
      fieldErrors: { title: 'Título repetido', shortcut: 'Atalho em uso' },
    })
  })

  it('erro sem details vira o rótulo do formulário, nunca a mensagem crua da exceção', async () => {
    const api: QuickRepliesWorkspaceApi = {
      createQuickReply: async () => {
        throw new Error('ECONNRESET: socket hang up')
      },
    }
    const result = await submitQuickReply({ api, editing: VALID_EDITING, labels: LABELS })
    expect(result).toEqual({ outcome: 'rejected', fieldErrors: {}, formError: LABELS.saveError })
  })

  it('409 com code aninhado em error.response.data.error (axios) vira erro no atalho', async () => {
    const api: QuickRepliesWorkspaceApi = {
      createQuickReply: async () => {
        throw {
          response: {
            data: {
              error: {
                code: 'QUICK_REPLY_SHORTCUT_TAKEN',
                message: 'Atalho já existe',
                details: [{ field: 'shortcut', message: 'Atalho já existe' }],
              },
            },
          },
        }
      },
    }
    const result = await submitQuickReply({ api, editing: VALID_EDITING, labels: LABELS })
    expect(result).toEqual({ outcome: 'rejected', fieldErrors: { shortcut: 'Atalho já existe' } })
  })

  it('erro aninhado em error.error (envelope { error: {...} }) vira erro no atalho', async () => {
    const api: QuickRepliesWorkspaceApi = {
      createQuickReply: async () => {
        throw {
          error: {
            code: 'QUICK_REPLY_SHORTCUT_TAKEN',
            message: 'Atalho já existe',
            details: [{ field: 'shortcut', message: 'Atalho já existe' }],
          },
        }
      },
    }
    const result = await submitQuickReply({ api, editing: VALID_EDITING, labels: LABELS })
    expect(result).toEqual({ outcome: 'rejected', fieldErrors: { shortcut: 'Atalho já existe' } })
  })

  it('erro aninhado em error.body.error vira erro no atalho', async () => {
    const api: QuickRepliesWorkspaceApi = {
      createQuickReply: async () => {
        throw { body: { error: { code: 'QUICK_REPLY_SHORTCUT_TAKEN' } } }
      },
    }
    const result = await submitQuickReply({ api, editing: VALID_EDITING, labels: LABELS })
    expect(result).toEqual({ outcome: 'rejected', fieldErrors: { shortcut: LABELS.shortcutTaken } })
  })
})

describe('insertAtCursor', () => {
  it('insere o marcador na posição do cursor', () => {
    expect(insertAtCursor('Olá !', 4, 4, '{{nome}}')).toEqual({ text: 'Olá {{nome}}!', caret: 12 })
  })

  it('troca a seleção pelo marcador', () => {
    expect(insertAtCursor('Olá NOME!', 4, 8, '{{nome}}')).toEqual({ text: 'Olá {{nome}}!', caret: 12 })
  })
})
