/**
 * Guarda o adaptador entre a lista nova de variáveis e as duas props antigas. O caso que decide o
 * desenho: com a lista nova presente, as antigas são ignoradas — duas fontes dariam valores
 * diferentes no chip e no botão de variáveis.
 */

import { describe, expect, it } from 'bun:test'

import { applyQuickReplyVariables } from '../MessageComposer'
import { resolveConversationVariables } from './resolveConversationVariables'

const CUSTOMER_NAME = { id: 'customerName', label: 'Nome', marker: '{{nome}}', value: 'Marina' }
const EMPTY_EMAIL = { id: 'email', label: 'E-mail', marker: '{{email}}', value: '' }

describe('resolveConversationVariables', () => {
  it('deriva o mapa e a lista do composer a partir da lista nova', () => {
    const result = resolveConversationVariables({ conversationVariables: [CUSTOMER_NAME] })
    expect(result.quickReplyVariables).toEqual({ nome: 'Marina' })
    expect(result.composerVariables).toEqual([{ id: 'customerName', label: 'Nome', value: 'Marina' }])
  })

  it('não oferece variável sem valor', () => {
    const result = resolveConversationVariables({ conversationVariables: [CUSTOMER_NAME, EMPTY_EMAIL] })
    expect(result.quickReplyVariables).toEqual({ nome: 'Marina' })
    expect(result.composerVariables).toHaveLength(1)
  })

  it('a lista nova manda sobre as props antigas', () => {
    const result = resolveConversationVariables({
      conversationVariables: [CUSTOMER_NAME],
      quickReplyVariables: { nome: 'Outro' },
      composerVariables: [{ id: 'x', label: 'X', value: 'y' }],
    })
    expect(result.quickReplyVariables).toEqual({ nome: 'Marina' })
    expect(result.composerVariables).toEqual([{ id: 'customerName', label: 'Nome', value: 'Marina' }])
  })

  it('sem a lista nova, devolve as props antigas intactas', () => {
    const quickReplyVariables = { nome: 'Marina' }
    const composerVariables = [{ id: 'x', label: 'X', value: 'y' }]
    const result = resolveConversationVariables({ quickReplyVariables, composerVariables })
    expect(result.quickReplyVariables).toBe(quickReplyVariables)
    expect(result.composerVariables).toBe(composerVariables)
  })

  it('sem nada, devolve ausência', () => {
    expect(resolveConversationVariables({})).toEqual({ quickReplyVariables: undefined, composerVariables: undefined })
  })

  it('marcador fora do formato cai no id', () => {
    const result = resolveConversationVariables({
      conversationVariables: [{ ...CUSTOMER_NAME, marker: 'nome' }],
    })
    expect(result.quickReplyVariables).toEqual({ customerName: 'Marina' })
  })

  it('o mapa derivado alimenta applyQuickReplyVariables sem mudança', () => {
    const { quickReplyVariables } = resolveConversationVariables({
      conversationVariables: [CUSTOMER_NAME, EMPTY_EMAIL],
    })
    expect(applyQuickReplyVariables('Olá {{nome}}, {{email}}', quickReplyVariables)).toBe('Olá Marina, ')
  })
})
