/**
 * Guarda a interpolação das mensagens rápidas.
 *
 * O caso que decide o desenho: variável ausente. Deixar `{{nome}}` no texto significa o atendente
 * mandar "Olá {{nome}}!" para o cliente — pior que a saudação sem nome.
 */

import { describe, expect, it } from 'bun:test'

import { applyQuickReplyVariables, resolveQuickReply } from './MessageComposer'

describe('applyQuickReplyVariables', () => {
  it('troca a variável pelo valor', () => {
    expect(applyQuickReplyVariables('Olá {{nome}}!', { nome: 'Marina' })).toBe('Olá Marina!')
  })

  it('aceita espaço dentro das chaves', () => {
    expect(applyQuickReplyVariables('Olá {{ nome }}!', { nome: 'Rita' })).toBe('Olá Rita!')
  })

  it('troca todas as ocorrências', () => {
    expect(applyQuickReplyVariables('{{nome}}, confirma? Obrigado, {{nome}}.', { nome: 'Ana' })).toBe(
      'Ana, confirma? Obrigado, Ana.',
    )
  })

  // Nunca vaza o literal para o cliente.
  it('apaga a variável que não foi passada', () => {
    expect(applyQuickReplyVariables('Olá {{nome}}!', {})).toBe('Olá !')
    expect(applyQuickReplyVariables('Olá {{nome}}!')).toBe('Olá !')
  })

  it('não mexe em texto sem variável', () => {
    expect(applyQuickReplyVariables('Bom dia!', { nome: 'X' })).toBe('Bom dia!')
  })
})

describe('resolveQuickReply', () => {
  it('interpola quando o texto é string', () => {
    const resolvido = resolveQuickReply({ key: 'g', label: '👋', text: 'Olá {{nome}}!' }, { nome: 'Rita' })

    expect(resolvido).toBe('Olá Rita!')
  })

  // A função existe para o que a string não resolve: escolher copy por produto, pluralizar, formatar.
  it('chama a função com as variáveis', () => {
    const resolvido = resolveQuickReply(
      { key: 's', label: '📋', text: (variables) => `Status de ${variables['produto'] ?? 'seu pedido'}` },
      { produto: 'financiamento' },
    )

    expect(resolvido).toBe('Status de financiamento')
  })

  it('função sem variáveis não quebra', () => {
    expect(resolveQuickReply({ key: 'c', label: '📞', text: () => 'Posso ligar?' })).toBe('Posso ligar?')
  })
})
