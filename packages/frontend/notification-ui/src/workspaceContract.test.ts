/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O pacote precisa exportar as telas COMPOSTAS, não só as peças.
 *
 * Existe porque a ausência disso já custou: exportando apenas `NotificationList` e
 * `PreferencesPanel`, o primeiro consumidor remontou o grid à mão — 221 linhas de página de
 * configuração e 207 de hook, contra 35 linhas da página de Documentos, que consome workspace. É o
 * que a regra de módulos plugáveis (§4) rejeita, e o que fez as telas divergirem entre produtos
 * antes.
 *
 * O teste é de superfície, não de comportamento: ele não pode provar que o layout está certo, mas
 * pode provar que existe UM lugar para o layout morar. Um `export` removido por engano quebra aqui
 * em vez de virar página de 200 linhas no próximo produto.
 */

import { describe, expect, it } from 'bun:test'

import * as surface from './index'
import * as headless from './headless'
import en from './locales/en.json'
import ptBR from './locales/pt-BR.json'

describe('superfície composta', () => {
  it('exporta as duas telas inteiras', () => {
    expect(typeof surface.NotificationsWorkspace).toBe('function')
    expect(typeof surface.NotificationSettingsWorkspace).toBe('function')
  })

  it('exporta as peças também — quem precisa de layout próprio não fica sem saída', () => {
    // Workspace é o caminho recomendado, não uma prisão: um produto com layout radicalmente
    // diferente compõe as peças, e é melhor que forkar o pacote.
    for (const piece of ['NotificationBell', 'NotificationList', 'NotificationItem', 'PreferencesPanel']) {
      expect(typeof (surface as Record<string, unknown>)[piece], piece).toBe('function')
    }
  })

  it('a lógica do editor é headless, para o produto trocar só o visual', () => {
    expect(typeof headless.useTemplateEditor).toBe('function')
  })

  it('criação, remoção e catálogo de variáveis também saem pela camada headless', () => {
    for (const hook of ['useTemplateVariables', 'useDeactivateTemplate', 'useCategoryPolicies']) {
      expect(typeof (headless as Record<string, unknown>)[hook], hook).toBe('function')
    }
  })
})

/**
 * O modo de falha aqui é mudo: a chave sem tradução cai no fallback do `label`, que devolve a
 * própria chave — e `settings.viewport.mobile` aparece escrito na tela do cliente.
 */
describe('locales', () => {
  it('pt-BR e en têm exatamente as mesmas chaves', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ptBR).sort())
  })

  it('nenhuma tradução ficou vazia', () => {
    for (const [key, value] of Object.entries({ ...en, ...ptBR })) {
      expect(String(value).length, key).toBeGreaterThan(0)
    }
  })
})

describe('contrato de customização', () => {
  /**
   * As quatro formas de customizar, e nenhuma flag `hasX`.
   *
   * A regra é explícita: capacidade opcional é por AUSÊNCIA de prop. `hasSettings` seria um segundo
   * jeito de dizer o que `settingsHref` já diz, e dois jeitos divergem — alguém passa a flag sem o
   * href e a tela desenha um link para lugar nenhum.
   */
  it('nenhuma prop de capacidade em forma de flag booleana `hasX`', () => {
    const sources = [
      Bun.file(`${import.meta.dir}/components/NotificationsWorkspace.tsx`),
      Bun.file(`${import.meta.dir}/components/NotificationSettingsWorkspace.tsx`),
    ]

    return Promise.all(sources.map((file) => file.text())).then((contents) => {
      for (const content of contents) {
        expect(content).not.toMatch(/readonly has[A-Z]/)
      }
    })
  })

  it('os dois workspaces aceitam labels e className', async () => {
    for (const name of ['NotificationsWorkspace', 'NotificationSettingsWorkspace']) {
      const content = await Bun.file(`${import.meta.dir}/components/${name}.tsx`).text()

      expect(content, `${name} sem labels`).toContain('labels?: Partial<')
      // `className` é o que deixa o produto posicionar a tela no layout dele sem tocar no pacote.
      expect(content, `${name} sem className`).toContain('className?: string')
    }
  })

  it('o workspace de configuração EXIGE canais e assuntos do produto', async () => {
    const content = await Bun.file(`${import.meta.dir}/components/NotificationSettingsWorkspace.tsx`).text()

    // Sem `?`: o pacote despacha em cinco canais e não tem opinião sobre quais um produto oferece.
    // Um default aqui faria o banco mostrar "WhatsApp" numa tela que nunca vai mandar WhatsApp.
    expect(content).toContain('readonly channels: readonly NotificationChannelOption[]')
    expect(content).toContain('readonly categories: readonly NotificationCategoryOption[]')
  })

  it('nenhum texto visível está escrito no componente — tudo passa por label()', async () => {
    for (const name of ['NotificationsWorkspace', 'NotificationSettingsWorkspace']) {
      const content = await Bun.file(`${import.meta.dir}/components/${name}.tsx`).text()
      /**
       * Texto entre tags JSX que não seja `{...}` — o que `web.md` §6 proíbe.
       *
       * O `\s*` nas pontas não é detalhe: a primeira versão deste regex exigia o texto colado nas
       * tags, e o Prettier põe o conteúdo em linha própria. O teste passava com
       * `>\n  Configurações\n<` no meio do componente, provando nada. Achei por mutação.
       */
      const hardcoded = content.match(/>\s*[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{3,}\s*</g)

      expect(hardcoded, `${name} com texto fixo: ${hardcoded?.join(' | ')}`).toBeNull()
    }
  })
})
