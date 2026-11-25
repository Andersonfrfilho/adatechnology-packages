/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * `possibleNext`: destinos que a action pode devolver em tempo de execução. O editor desenha, valida
 * e limpa esses caminhos como qualquer outro, sem mudar o `next` do nó.
 */

import { describe, expect, it } from 'bun:test'
import { buildFlowEdges } from './flowCanvasModel'
import { applyConnection, clearConnection, removeNodeAndCleanRefs, resolveConnection } from './flowEditorOps'
import { estimateNodeHeight, possibleNextHandle, validateGraph, type FlowGraphData } from './flowGraph'
import { DEFAULT_FLOW_EDITOR_LABELS } from './labels'

function bookingGraph(): FlowGraphData {
  return {
    key: 'main',
    label: 'Main',
    startNodeId: 'check',
    version: 1,
    nodes: {
      check: { id: 'check', type: 'action', actionKind: 'check_slot', possibleNext: ['full'], next: 'confirm' },
      confirm: { id: 'confirm', type: 'action', directMessage: 'Reservado!' },
      full: { id: 'full', type: 'action', directMessage: 'Lotado.' },
    },
  }
}

describe('possibleNext in the flow editor', () => {
  it('draws a dashed edge from its own handle and keeps the target reachable', () => {
    const graph = bookingGraph()
    const edges = buildFlowEdges({ openKeys: ['main'], graphs: { main: graph }, rootFlowKey: 'main' })
    expect(edges).toContainEqual(
      expect.objectContaining({
        source: 'main::check',
        target: 'main::full',
        sourceHandle: possibleNextHandle('full'),
        kind: 'fallback',
        live: false,
      }),
    )
    const messages = validateGraph(graph, DEFAULT_FLOW_EDITOR_LABELS.validation).map((issue) => issue.message)
    expect(messages.filter((message) => message.includes('full'))).toEqual([])
  })

  it('flags a broken possible target and possibleNext on a node that cannot branch', () => {
    const graph = bookingGraph()
    graph.nodes.check = { ...graph.nodes.check!, possibleNext: ['ghost'] }
    graph.nodes.confirm = { ...graph.nodes.confirm!, possibleNext: ['full'] }
    const issues = validateGraph(graph, DEFAULT_FLOW_EDITOR_LABELS.validation)
    expect(issues.some((issue) => issue.severity === 'error' && issue.message.includes('ghost'))).toBe(true)
    expect(issues.some((issue) => issue.severity === 'warning' && issue.nodeId === 'confirm')).toBe(true)
  })

  it('reconnects, disconnects and cleans possible targets without touching next', () => {
    const graphs = { main: bookingGraph() }
    const check = graphs.main.nodes.check!
    const resolved = resolveConnection({
      connection: { source: 'main::check', target: 'main::confirm', sourceHandle: possibleNextHandle('full') },
      graphs,
    })
    expect(resolved && applyConnection(check, resolved)).toMatchObject({ possibleNext: ['confirm'], next: 'confirm' })
    expect(clearConnection(check, possibleNextHandle('full'))).toMatchObject({ possibleNext: [], next: 'confirm' })
    expect(removeNodeAndCleanRefs(graphs.main.nodes, 'full').check).toMatchObject({ possibleNext: [], next: 'confirm' })
  })

  it('makes the card taller by one row per possible target', () => {
    const check = bookingGraph().nodes.check!
    expect(estimateNodeHeight(check)).toBeGreaterThan(estimateNodeHeight({ ...check, possibleNext: undefined }))
  })
})
