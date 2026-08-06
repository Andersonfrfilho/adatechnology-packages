/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O subpath `/flows` precisa exportar a TELA, não só as peças.
 *
 * Existe porque a ausência disso já custou: exportando apenas `FlowMapCanvas`, `FlowPalette` e
 * `FlowNodePanel`, o financiamento montou a tela por conta — 973 linhas de página mais um fork local
 * dos componentes, que ficou atrás do pacote. O quickcart, para ter a mesma tela, teria que copiar o
 * arquivo. É exatamente a divergência que `pluggable-module.md` §4 proíbe.
 *
 * O teste é de superfície, não de comportamento: não prova que o canvas desenha certo, prova que
 * existe UM lugar onde a tela mora, e que ela aceita customização por contrato em vez de por fork.
 */

import { describe, expect, it } from 'bun:test'

import * as flows from './index'
import { DEFAULT_FLOW_EDITOR_LABELS, mergeFlowEditorLabels } from './labels'

const WORKSPACE_SOURCE = `${import.meta.dir}/FlowsWorkspace.tsx`

describe('superfície composta', () => {
  it('exporta a tela inteira', () => {
    expect(typeof flows.FlowsWorkspace).toBe('function')
  })

  it('exporta as peças também — quem precisa de layout próprio não fica sem saída', () => {
    // Workspace é o caminho recomendado, não uma prisão: um produto com layout radicalmente
    // diferente compõe as peças, e isso é melhor que forkar o pacote.
    for (const piece of ['FlowMapCanvas', 'FlowPalette', 'FlowNodePanel', 'FlowEditorCanvas', 'FlowWhatsAppPreview']) {
      expect(typeof (flows as Record<string, unknown>)[piece], piece).toBe('function')
    }
  })

  it('expõe o estado headless, para o produto trocar só o visual', () => {
    expect(typeof flows.useFlowsEditor).toBe('function')
  })

  it('as operações de grafo saem puras, sem passar pela tela', () => {
    for (const operation of ['resolveConnection', 'applyConnection', 'removeNodeAndCleanRefs', 'buildFlowEdges']) {
      expect(typeof (flows as Record<string, unknown>)[operation], operation).toBe('function')
    }
  })
})

describe('contrato de customização', () => {
  it('nenhuma capacidade em forma de flag booleana `hasX`', async () => {
    /**
     * Capacidade opcional é por AUSÊNCIA de prop. `hasDelete` seria um segundo jeito de dizer o que
     * `deletableFlowKeys` já diz, e dois jeitos divergem — alguém liga a flag sem a lista e a tela
     * desenha um botão que não exclui nada.
     */
    const content = await Bun.file(WORKSPACE_SOURCE).text()

    expect(content).not.toMatch(/readonly has[A-Z]/)
  })

  it('aceita labels, className e os slots de render', async () => {
    const content = await Bun.file(WORKSPACE_SOURCE).text()

    expect(content).toContain('labels?: Partial<')
    // `className` é o que deixa o produto posicionar a tela no layout dele sem tocar no pacote.
    expect(content).toContain('className?: string')
    expect(content).toContain('renderMediaPicker?:')
  })

  it('nenhum texto visível escrito no componente — tudo passa por labels', async () => {
    const content = await Bun.file(WORKSPACE_SOURCE).text()
    /**
     * Texto entre tags JSX que não seja `{...}`, que é o que `web.md` §6 proíbe.
     *
     * O `\s*` nas pontas não é detalhe: a primeira versão deste regex no notification-ui exigia o
     * texto colado nas tags, e o Prettier põe o conteúdo em linha própria — o teste passava com
     * `>\n  Configurações\n<` no meio do componente, provando nada.
     */
    const hardcoded = content.match(/>\s*[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{3,}\s*</g)

    expect(hardcoded, `texto fixo: ${hardcoded?.join(' | ')}`).toBeNull()
  })

  it('o produto sobrescreve UM texto sem perder os outros do mesmo grupo', () => {
    const merged = mergeFlowEditorLabels({ workspace: { ...DEFAULT_FLOW_EDITOR_LABELS.workspace, title: 'Jornadas' } })

    expect(merged.workspace.title).toBe('Jornadas')
    expect(merged.workspace.saveGraph).toBe(DEFAULT_FLOW_EDITOR_LABELS.workspace.saveGraph)
  })

  it('grupo novo de label entra no merge profundo', () => {
    // Esquecer o grupo no `mergeFlowEditorLabels` deixa o override apagar os irmãos dele, e o
    // sintoma é texto sumindo da tela — não erro.
    for (const group of ['workspace', 'flowManager', 'validation', 'collectionChain'] as const) {
      const merged = mergeFlowEditorLabels({ [group]: {} })

      expect(Object.keys(merged[group]).length, group).toBe(Object.keys(DEFAULT_FLOW_EDITOR_LABELS[group]).length)
    }
  })
})
