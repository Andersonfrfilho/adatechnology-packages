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

/** O mínimo absoluto: só boas-vindas e encerramento. Sem tópicos, sem WhatsApp. */
const MINIMAL_API: MessagesWorkspaceApi = {
  getMessages: async () => ({ welcomeMessage: '', farewellMessage: '' }),
  saveMessages: async () => undefined,
}

/**
 * Templates SEM listagem — a combinação do quickcart.
 *
 * Salvar qual template usar não depende de conseguir listar os aprovados na Meta, e amarrar as duas
 * coisas tirava desse produto a única forma de configurar o envio.
 */
const TEMPLATES_WITHOUT_LISTING_API: MessagesWorkspaceApi = {
  ...MINIMAL_API,
  getTemplateSettings: async () => ({ templateName: '', templateLanguage: 'pt_BR', variables: [] }),
  saveTemplateSettings: async () => undefined,
}

/** Templates completos e sem tópicos — a combinação do sakura-bot. */
const NO_TOPICS_API: MessagesWorkspaceApi = {
  ...TEMPLATES_WITHOUT_LISTING_API,
  listTemplates: async () => [],
  createTemplate: async () => ({ ok: true, message: 'criado' }),
}

/** Tudo — a combinação do financiamento. */
const FULL_API: MessagesWorkspaceApi = {
  ...NO_TOPICS_API,
  getTopics: async () => [],
  saveTopics: async () => undefined,
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
  welcomePlaceholders: ['{empresa}'],
  renderTemplatesNotice: () => 'A listagem de aprovados ainda não existe neste produto.',
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

  it('as três combinações reais dos produtos de hoje são válidas', () => {
    // Cada uma existe num produto. Se o contrato exigir algo que um deles não tem, o tsc reprova aqui
    // — que é o que faltou quando as três páginas foram escritas contra uma api ainda em desenho.
    expect(MINIMAL_API.getTopics).toBeUndefined()
    expect(MINIMAL_API.getTemplateSettings).toBeUndefined()

    expect(TEMPLATES_WITHOUT_LISTING_API.getTemplateSettings).toBeDefined()
    expect(TEMPLATES_WITHOUT_LISTING_API.listTemplates).toBeUndefined()

    expect(NO_TOPICS_API.getTopics).toBeUndefined()
    expect(NO_TOPICS_API.createTemplate).toBeDefined()

    expect(FULL_API.getTopics).toBeDefined()
  })

  it('nenhum texto visível escrito no componente — tudo passa por labels', async () => {
    const content = await Bun.file(SOURCE).text()
    const hardcoded = content.match(/>\s*[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{3,}\s*</g)

    expect(hardcoded, `texto fixo: ${hardcoded?.join(' | ')}`).toBeNull()
  })
})
