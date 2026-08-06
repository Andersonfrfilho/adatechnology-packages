/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O pacote precisa exportar a TELA de mensagens, não só os formulários — e a forma que o produto
 * escreve tem que compilar aqui, não no `bun install` dele.
 *
 * Os formulários já existiam e não bastaram: o financiamento remontou abas, estado e salvamento em
 * cima deles, e o quickcart teria que copiar a página para ter a mesma tela. É a divergência que
 * `pluggable-module.md` §4 proíbe.
 */

import { describe, expect, it } from 'bun:test'

import { MessagesWorkspace, type MessagesWorkspaceProps } from './MessagesWorkspace'
import type { MessagesWorkspaceApi } from './useMessagesEditor'
import type { WhatsAppTemplateVariableSuggestion } from './WhatsAppTemplateSettingsForm'

const SOURCE = `${import.meta.dir}/MessagesWorkspace.tsx`

const VARIABLES: WhatsAppTemplateVariableSuggestion[] = [{ token: '{clientName}', label: 'Nome do cliente' }]

/** A api mínima: sem WhatsApp nenhum. É o que prova que a aba de templates é opcional de verdade. */
const BOT_ONLY_API: MessagesWorkspaceApi = {
  getMessages: async () => ({ welcomeMessage: '', farewellMessage: '' }),
  saveMessages: async () => undefined,
  getTopics: async () => [],
  saveTopics: async () => undefined,
  getTemplateSettings: async () => ({ templateName: '', templateLanguage: 'pt_BR', variables: [] }),
  saveTemplateSettings: async () => undefined,
}

const FULL_API: MessagesWorkspaceApi = {
  ...BOT_ONLY_API,
  listTemplates: async () => [],
  createTemplate: async () => ({ ok: true, message: 'criado' }),
}

const PROPS: MessagesWorkspaceProps = {
  api: FULL_API,
  labels: {
    title: 'Mensagens',
    subtitle: 'O que o bot diz',
    tabBot: 'Bot',
    tabTemplates: 'Templates',
    welcomeFarewell: { saveSuccess: 'Salvo' },
    topics: { sectionTitle: 'Tópicos', saveButton: 'Salvar' },
  },
  availableVariables: VARIABLES,
  className: 'max-w-2xl pb-8',
}

describe('superfície composta', () => {
  it('exporta a tela inteira', () => {
    expect(typeof MessagesWorkspace).toBe('function')
  })

  it('a forma que o produto passa compila', () => {
    // O valor está na COMPILAÇÃO: um label ou campo de api faltando reprova aqui.
    expect(PROPS.className).toBe('max-w-2xl pb-8')
  })
})

describe('contrato de customização', () => {
  it('nenhuma capacidade em forma de flag `hasX` nas props', async () => {
    const content = await Bun.file(SOURCE).text()

    // `hasTemplates` existe como variável DERIVADA de `api.listTemplates`, e é justamente o oposto de
    // uma flag: não há como o produto ligá-la sem ter a capacidade.
    expect(content).not.toMatch(/readonly has[A-Z]/)
  })

  it('aceita labels parciais e className', async () => {
    const content = await Bun.file(SOURCE).text()

    expect(content).toContain('labels?: Partial<')
    expect(content).toContain('className?: string')
  })

  it('sem `listTemplates` a api segue válida, e sem `createTemplate` também', () => {
    expect(BOT_ONLY_API.listTemplates).toBeUndefined()
    expect(BOT_ONLY_API.createTemplate).toBeUndefined()
    // Ler templates sem saber criar é combinação real: produto que usa template aprovado por fora.
    const readOnly: MessagesWorkspaceApi = { ...BOT_ONLY_API, listTemplates: async () => [] }
    expect(readOnly.createTemplate).toBeUndefined()
  })

  it('nenhum texto visível escrito no componente — tudo passa por labels', async () => {
    const content = await Bun.file(SOURCE).text()
    const hardcoded = content.match(/>\s*[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{3,}\s*</g)

    expect(hardcoded, `texto fixo: ${hardcoded?.join(' | ')}`).toBeNull()
  })
})
