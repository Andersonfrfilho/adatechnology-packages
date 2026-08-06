/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A forma que o produto realmente escreve, compilada pelo tsc do pacote.
 *
 * Existe porque a versão anterior deste trio quebrou justamente aqui: o pacote compilava, os testes
 * passavam, e o produto não. Um `labels` sem grupo novo ou uma `api` com campo de outro formato só
 * aparece quando alguém monta o objeto de verdade — e esperar o `bun install` do produto para
 * descobrir custa um ciclo de publicação inteiro.
 *
 * É cópia deliberada do `FlowsBlueprintPage` do financiamento. Divergir dele é o sinal de que o
 * contrato mudou sem o consumidor saber.
 */

import { describe, expect, it } from 'bun:test'
import type { FlowGraphData } from '@adatechnology/meta-whatsapp-contracts'

import { FlowsWorkspace, type FlowsWorkspaceProps } from './FlowsWorkspace'
import type { FlowLivePosition, FlowsWorkspaceApi } from './index'
import { mergeFlowEditorLabels } from './labels'

const MENU_FLOW_KEY = 'menu'

/** O produto guarda a posição do menu num campo próprio; o pacote só conhece flowKey/nodeId. */
type ProductLivePositionRow = {
  currentState: string
  flow: string | null
  nodeId: string | null
  menuNodeId: string | null
}

function toLivePosition(row: ProductLivePositionRow): FlowLivePosition {
  const isInMenu = row.flow === null || row.flow === MENU_FLOW_KEY
  return isInMenu ? { flowKey: MENU_FLOW_KEY, nodeId: row.menuNodeId } : { flowKey: row.flow, nodeId: row.nodeId }
}

const FLOWS_API: FlowsWorkspaceApi = {
  getGraphs: async () => ({}) as Record<string, FlowGraphData>,
  saveGraph: async () => undefined,
  createFlow: async () => undefined,
  deleteFlow: async () => undefined,
  getLivePositions: async () => ([] as ProductLivePositionRow[]).map(toLivePosition),
}

/** Vocabulário do produto: parcial, com os grupos que ele traduz e sem os que aceita como estão. */
const PRODUCT_LABELS: FlowsWorkspaceProps['labels'] = {
  detachedNodeTooltip: 'Falta ligar este card',
  collectionChain: { feeds: (action) => `Coleta para: ${action}` },
  flowMap: {
    nodeCount: (count) => `${count} nós`,
    openFlow: 'Abrir',
    toggleToMap: 'Mapa',
    toggleToDetail: 'Fluxo',
  },
  workspace: {
    title: 'Fluxos de conversa',
    subtitle: 'Desenhe e publique',
    loading: 'Carregando…',
    loadError: 'Falhou',
    saveGraph: 'Publicar',
    saving: 'Publicando…',
    saveSuccess: 'Publicado',
    saveError: 'Não publicou',
    organize: 'Organizar',
    organizeTooltip: 'Reposiciona',
    discardChanges: 'Descartar',
    discardTooltip: 'Volta ao publicado',
    discardConfirm: 'Descartar?',
    unsavedChangesConfirm: 'Perder alterações?',
  },
}

const PROPS: FlowsWorkspaceProps = {
  api: FLOWS_API,
  rootFlowKey: MENU_FLOW_KEY,
  labels: PRODUCT_LABELS,
  actionOptions: [{ actionKind: 'trigger_simulation', label: 'Disparar simulação' }],
  renderMediaPicker: (node, graph) => `${graph.key}:${node.id}`,
}

describe('contrato visto pelo produto', () => {
  it('a tela aceita o conjunto de props que o produto passa', () => {
    // O valor está na COMPILAÇÃO deste arquivo: se `FlowsWorkspaceProps` perder um campo que o
    // produto usa, o tsc reprova aqui e não no `bun install` do produto.
    expect(typeof FlowsWorkspace).toBe('function')
    expect(PROPS.rootFlowKey).toBe(MENU_FLOW_KEY)
  })

  it('grupo de label que o produto NÃO traduz continua com o texto do pacote', () => {
    const merged = mergeFlowEditorLabels(PRODUCT_LABELS)

    expect(merged.flowManager.newFlow.length).toBeGreaterThan(0)
    expect(merged.validation.title.length).toBeGreaterThan(0)
    expect(merged.nodePanel.cancel.length).toBeGreaterThan(0)
  })

  it('sem `getLivePositions` a api continua válida — a capacidade é por ausência', () => {
    const readOnlyApi: FlowsWorkspaceApi = {
      getGraphs: FLOWS_API.getGraphs,
      saveGraph: FLOWS_API.saveGraph,
      createFlow: FLOWS_API.createFlow,
      deleteFlow: FLOWS_API.deleteFlow,
    }

    expect(readOnlyApi.getLivePositions).toBeUndefined()
  })
})
