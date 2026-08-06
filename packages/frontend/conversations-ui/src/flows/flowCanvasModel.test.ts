/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O que se prova aqui é topologia e posição, não estilo.
 *
 * Aresta com destino errado não pinta errado — ela manda a conversa do cliente para outro lugar, e
 * quem editou nunca vê. Card que o layout joga para fora da área visível se lê como "apaguei sem
 * querer". São os dois modos de falhar que já aconteceram na página original, e os dois são
 * silenciosos.
 */

import { describe, expect, it } from 'bun:test'
import type { FlowGraphData, FlowNodeData } from '@adatechnology/meta-whatsapp-contracts'

import {
  buildFlowEdges,
  chainFrameBounds,
  computeMergedLayout,
  countLiveByNode,
  detachedNodeIds,
  newNodeFromSpec,
  portalNodeId,
} from './flowCanvasModel'

/** Nós mínimos VÁLIDOS pelo contrato — sem `as`, para quebrar quando a forma do nó mudar. */
function node(id: string, next?: FlowNodeData['next']): FlowNodeData {
  return { id, type: 'question', question: id, ...(next === undefined ? {} : { next }) }
}

function graph(params: { key: string; start: string; nodes: FlowNodeData[] }): FlowGraphData {
  return {
    key: params.key,
    label: params.key,
    version: 1,
    startNodeId: params.start,
    nodes: Object.fromEntries(params.nodes.map((each) => [each.id, each])),
  }
}

describe('arestas', () => {
  it('saída única vira aresta linear sem handle', () => {
    const graphs = { menu: graph({ key: 'menu', start: 'a', nodes: [node('a', 'b'), node('b')] }) }

    const edges = buildFlowEdges({ openKeys: ['menu'], graphs })

    expect(edges).toEqual([
      { id: 'menu::a->menu::b', source: 'menu::a', target: 'menu::b', kind: 'linear', crossFlow: false, live: false },
    ])
  })

  it('ramificação leva o id da opção no handle, e o default vira fallback', () => {
    const graphs = {
      menu: graph({
        key: 'menu',
        start: 'p',
        nodes: [node('p', { byAnswer: { sim: 'x' }, default: 'y' }), node('x'), node('y')],
      }),
    }

    const edges = buildFlowEdges({ openKeys: ['menu'], graphs })

    expect(edges.find((each) => each.kind === 'branch')).toMatchObject({ sourceHandle: 'sim', target: 'menu::x' })
    // O handle do fallback é fixo `__default` — é o que o `applyConnection` espera de volta quando
    // alguém arrasta esse fio.
    expect(edges.find((each) => each.kind === 'fallback')).toMatchObject({
      sourceHandle: '__default',
      target: 'menu::y',
    })
  })

  it('destino vazio NÃO gera aresta', () => {
    // Apagar um nó zera quem apontava para ele. A aresta iria para `menu::`, que não existe, e o
    // React Flow descarta em silêncio — a opção pareceria ligada sem estar.
    const graphs = {
      menu: graph({ key: 'menu', start: 'p', nodes: [node('p', { byAnswer: { sim: '' }, default: '' })] }),
    }

    expect(buildFlowEdges({ openKeys: ['menu'], graphs })).toEqual([])
  })

  it('salto para fluxo MESCLADO liga no nó inicial dele, não num portal', () => {
    const graphs = {
      menu: graph({ key: 'menu', start: 'a', nodes: [node('a', 'flow:sim')] }),
      sim: graph({ key: 'sim', start: 's1', nodes: [node('s1')] }),
    }

    const edges = buildFlowEdges({ openKeys: ['menu', 'sim'], graphs })

    expect(edges[0]).toMatchObject({ target: 'sim::s1', crossFlow: true })
  })

  it('salto para fluxo NÃO mesclado cai no portal', () => {
    const graphs = {
      menu: graph({ key: 'menu', start: 'a', nodes: [node('a', 'flow:sim')] }),
      sim: graph({ key: 'sim', start: 's1', nodes: [node('s1')] }),
    }

    const edges = buildFlowEdges({ openKeys: ['menu'], graphs })

    expect(edges[0]!.target).toBe(`menu::${portalNodeId('a', 'flow:sim')}`)
  })

  it('duas opções para o mesmo fluxo compartilham UM portal', () => {
    const graphs = {
      menu: graph({
        key: 'menu',
        start: 'p',
        nodes: [node('p', { byAnswer: { um: 'flow:sim', dois: 'flow:sim' }, default: '' })],
      }),
      sim: graph({ key: 'sim', start: 's1', nodes: [node('s1')] }),
    }

    const edges = buildFlowEdges({ openKeys: ['menu'], graphs })

    // Duas arestas (uma por opção), um só destino: senão o card ficaria cercado de caixas iguais.
    expect(edges).toHaveLength(2)
    expect(new Set(edges.map((each) => each.target)).size).toBe(1)
  })

  it('conversa parada no nó anima a aresta que sai dele, mas nunca o fallback', () => {
    const graphs = {
      menu: graph({
        key: 'menu',
        start: 'p',
        nodes: [node('p', { byAnswer: { sim: 'x' }, default: 'y' }), node('x'), node('y')],
      }),
    }

    const edges = buildFlowEdges({
      openKeys: ['menu'],
      graphs,
      livePositions: [{ flowKey: 'menu', nodeId: 'p' }],
    })

    expect(edges.find((each) => each.kind === 'branch')!.live).toBe(true)
    // Fallback piscando dava a impressão de que a conversa estava passando pelo caminho que
    // ninguém escolheu.
    expect(edges.find((each) => each.kind === 'fallback')!.live).toBe(false)
  })

  it('ids de aresta são únicos entre fluxos com nós homônimos', () => {
    const graphs = {
      menu: graph({ key: 'menu', start: 'inicio', nodes: [node('inicio', 'fim'), node('fim')] }),
      sim: graph({ key: 'sim', start: 'inicio', nodes: [node('inicio', 'fim'), node('fim')] }),
    }

    const edges = buildFlowEdges({ openKeys: ['menu', 'sim'], graphs })

    expect(new Set(edges.map((each) => each.id)).size).toBe(edges.length)
  })
})

describe('contagem ao vivo', () => {
  const positions = [
    { flowKey: 'menu', nodeId: 'a' },
    { flowKey: 'menu', nodeId: 'a' },
    { flowKey: 'sim', nodeId: 'a' },
    { flowKey: null, nodeId: null },
  ]

  it('agrupa por nó e ignora outro fluxo', () => {
    expect(countLiveByNode('menu', positions)).toEqual({ a: 2 })
  })

  it('sem posições devolve vazio, em vez de estourar', () => {
    expect(countLiveByNode('menu', undefined)).toEqual({})
  })
})

describe('layout mesclado', () => {
  it('ranqueia da esquerda para a direita a partir do início do fluxo primário', () => {
    const graphs = { menu: graph({ key: 'menu', start: 'a', nodes: [node('a', 'b'), node('b', 'c'), node('c')] }) }

    const positions = computeMergedLayout({ openKeys: ['menu'], graphs, primaryFlowKey: 'menu' })

    expect(positions.get('menu::a')!.x).toBe(0)
    expect(positions.get('menu::b')!.x).toBeGreaterThan(positions.get('menu::a')!.x)
    expect(positions.get('menu::c')!.x).toBeGreaterThan(positions.get('menu::b')!.x)
  })

  it('atravessa o salto entre fluxos ao ranquear', () => {
    const graphs = {
      menu: graph({ key: 'menu', start: 'a', nodes: [node('a', 'flow:sim')] }),
      sim: graph({ key: 'sim', start: 's1', nodes: [node('s1')] }),
    }

    const positions = computeMergedLayout({ openKeys: ['menu', 'sim'], graphs, primaryFlowKey: 'menu' })

    expect(positions.get('sim::s1')!.x).toBeGreaterThan(positions.get('menu::a')!.x)
  })

  it('TODOS os órfãos ficam na MESMA coluna extra', () => {
    // Uma coluna por órfão empurrava cada um mais para longe da área visível, e desligar um fio se
    // lia como "o card sumiu". É o motivo de existir uma camada única.
    const graphs = {
      menu: graph({ key: 'menu', start: 'a', nodes: [node('a'), node('orfao1'), node('orfao2'), node('orfao3')] }),
    }

    const positions = computeMergedLayout({ openKeys: ['menu'], graphs, primaryFlowKey: 'menu' })
    const strayX = ['orfao1', 'orfao2', 'orfao3'].map((id) => positions.get(`menu::${id}`)!.x)

    expect(new Set(strayX).size).toBe(1)
    expect(strayX[0]).toBeGreaterThan(positions.get('menu::a')!.x)
  })

  it('órfãos na mesma coluna não se sobrepõem', () => {
    const graphs = { menu: graph({ key: 'menu', start: 'a', nodes: [node('a'), node('o1'), node('o2')] }) }

    const positions = computeMergedLayout({ openKeys: ['menu'], graphs, primaryFlowKey: 'menu' })

    expect(positions.get('menu::o1')!.y).not.toBe(positions.get('menu::o2')!.y)
  })

  it('ciclo não estoura a pilha', () => {
    const graphs = { menu: graph({ key: 'menu', start: 'a', nodes: [node('a', 'b'), node('b', 'a')] }) }

    expect(computeMergedLayout({ openKeys: ['menu'], graphs, primaryFlowKey: 'menu' }).size).toBe(2)
  })

  it('fluxo primário ausente ainda posiciona todo mundo, em vez de devolver vazio', () => {
    const graphs = { sim: graph({ key: 'sim', start: 's1', nodes: [node('s1')] }) }

    // Acontece entre o clique em "focar" e a chegada do grafo: sem isto o canvas ficava em branco.
    expect(computeMergedLayout({ openKeys: ['sim'], graphs, primaryFlowKey: 'menu' }).size).toBe(1)
  })
})

describe('nós soltos', () => {
  it('quem ninguém aponta está solto; o nó inicial nunca está', () => {
    const target = graph({ key: 'menu', start: 'a', nodes: [node('a', 'b'), node('b'), node('solto')] })

    expect(detachedNodeIds(target)).toEqual(new Set(['solto']))
  })

  it('salto para outro fluxo não conta como ligação local', () => {
    const target = graph({ key: 'menu', start: 'a', nodes: [node('a', 'flow:sim'), node('b')] })

    expect(detachedNodeIds(target).has('b')).toBe(true)
  })
})

describe('moldura da cadeia de coleta', () => {
  it('envolve todos os nós e abre espaço para o rótulo acima', () => {
    const target = graph({ key: 'menu', start: 'a', nodes: [node('a'), node('b')] })
    const positions: Record<string, { x: number; y: number }> = { a: { x: 0, y: 0 }, b: { x: 100, y: 50 } }

    const bounds = chainFrameBounds({
      nodeIds: ['a', 'b'],
      graph: target,
      positionOf: (id) => positions[id]!,
      padding: 10,
    })

    expect(bounds.x).toBe(-10)
    // O rótulo é desenhado acima da borda, então o topo sobe além do padding.
    expect(bounds.y).toBeLessThan(-10)
    expect(bounds.width).toBeGreaterThan(100)
    expect(bounds.height).toBeGreaterThan(50)
  })
})

describe('nó novo da paleta', () => {
  it('pergunta nasce com contextKey igual ao id', () => {
    // Sem contextKey o motor faz a pergunta e descarta a resposta, sem erro em lugar nenhum.
    const created = newNodeFromSpec({ kind: 'question', questionType: 'text' }, new Set())

    expect(created.contextKey).toBe(created.id)
  })

  it('decisão nasce com duas opções, para já dar o que ligar', () => {
    const created = newNodeFromSpec({ kind: 'decision' }, new Set())

    expect(created.options).toHaveLength(2)
    expect(created.questionType).toBe('choice')
  })

  it('id não colide com o que já existe', () => {
    const first = newNodeFromSpec({ kind: 'condition' }, new Set())
    const second = newNodeFromSpec({ kind: 'condition' }, new Set([first.id]))

    expect(second.id).not.toBe(first.id)
  })

  it('ação carrega o kind escolhido na paleta', () => {
    expect(newNodeFromSpec({ kind: 'action', actionKind: 'handoff' }, new Set()).actionKind).toBe('handoff')
  })
})
