/**
 * O que se prova aqui é topologia e posição, não estilo.
 *
 * Aresta com destino errado não pinta errado — ela manda a conversa do cliente para outro lugar, e
 * quem editou nunca vê. Card que o layout joga para fora da área visível se lê como "apaguei sem
 * querer". São os dois modos de falhar que já aconteceram nesta tela, e os dois são silenciosos.
 */

import { describe, expect, it } from 'bun:test'

import {
  buildFlowEdges,
  chainFrameBounds,
  computeMergedLayout,
  countLiveByNode,
  detachedNodeIds,
  newNodeFromSpec,
  portalNodeId,
  type FlowLivePosition,
  findFreeSlot,
} from './flowCanvasModel'
import { estimateNodeHeight, type FlowGraphData, type FlowNodeData } from './flowGraph'

const ROOT = 'menu'

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

function live(params: Partial<FlowLivePosition>): FlowLivePosition {
  return { currentState: 'x', flow: null, nodeId: null, menuNodeId: null, ...params }
}

describe('arestas', () => {
  it('saída única vira aresta linear sem handle', () => {
    const graphs = { menu: graph({ key: 'menu', start: 'a', nodes: [node('a', 'b'), node('b')] }) }

    expect(buildFlowEdges({ openKeys: ['menu'], graphs, rootFlowKey: ROOT })).toEqual([
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

    const edges = buildFlowEdges({ openKeys: ['menu'], graphs, rootFlowKey: ROOT })

    expect(edges.find((each) => each.kind === 'branch')).toMatchObject({ sourceHandle: 'sim', target: 'menu::x' })
    // O handle do fallback é fixo `__default` — é o que `applyConnection` espera de volta quando
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

    expect(buildFlowEdges({ openKeys: ['menu'], graphs, rootFlowKey: ROOT })).toEqual([])
  })

  it('salto para fluxo MESCLADO liga no nó inicial dele, não num portal', () => {
    const graphs = {
      menu: graph({ key: 'menu', start: 'a', nodes: [node('a', 'flow:sim')] }),
      sim: graph({ key: 'sim', start: 's1', nodes: [node('s1')] }),
    }

    expect(buildFlowEdges({ openKeys: ['menu', 'sim'], graphs, rootFlowKey: ROOT })[0]).toMatchObject({
      target: 'sim::s1',
      crossFlow: true,
    })
  })

  it('salto para fluxo NÃO mesclado cai no portal', () => {
    const graphs = {
      menu: graph({ key: 'menu', start: 'a', nodes: [node('a', 'flow:sim')] }),
      sim: graph({ key: 'sim', start: 's1', nodes: [node('s1')] }),
    }

    expect(buildFlowEdges({ openKeys: ['menu'], graphs, rootFlowKey: ROOT })[0]!.target).toBe(
      `menu::${portalNodeId('a', 'flow:sim')}`,
    )
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

    const edges = buildFlowEdges({ openKeys: ['menu'], graphs, rootFlowKey: ROOT })

    // Duas arestas (uma por opção), um só destino: senão o card fica cercado de caixas iguais.
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
      rootFlowKey: ROOT,
      livePositions: [live({ menuNodeId: 'p' })],
    })

    expect(edges.find((each) => each.kind === 'branch')!.live).toBe(true)
    // Fallback piscando sugeria que a conversa estava passando pelo caminho que ninguém escolheu.
    expect(edges.find((each) => each.kind === 'fallback')!.live).toBe(false)
  })

  it('ids de aresta são únicos entre fluxos com nós homônimos', () => {
    const graphs = {
      menu: graph({ key: 'menu', start: 'inicio', nodes: [node('inicio', 'fim'), node('fim')] }),
      sim: graph({ key: 'sim', start: 'inicio', nodes: [node('inicio', 'fim'), node('fim')] }),
    }

    const edges = buildFlowEdges({ openKeys: ['menu', 'sim'], graphs, rootFlowKey: ROOT })

    expect(new Set(edges.map((each) => each.id)).size).toBe(edges.length)
  })
})

describe('contagem ao vivo', () => {
  it('no fluxo RAIZ a posição vem de menuNodeId', () => {
    // O servidor guarda o passo do menu num campo próprio, e conversa no menu não carrega `flow`.
    // Ler `nodeId` aqui daria zero na tela mais visitada do editor.
    const positions = [live({ menuNodeId: 'saudacao' }), live({ menuNodeId: 'saudacao' })]

    expect(countLiveByNode({ flowKey: ROOT, rootFlowKey: ROOT, positions })).toEqual({ saudacao: 2 })
  })

  it('fora da raiz a posição vem de nodeId, e outro fluxo é ignorado', () => {
    const positions = [live({ flow: 'sim', nodeId: 'renda' }), live({ flow: 'outro', nodeId: 'renda' })]

    expect(countLiveByNode({ flowKey: 'sim', rootFlowKey: ROOT, positions })).toEqual({ renda: 1 })
  })

  it('sem posições devolve vazio, em vez de estourar', () => {
    expect(countLiveByNode({ flowKey: ROOT, rootFlowKey: ROOT, positions: undefined })).toEqual({})
  })

  it('linha já agregada pelo servidor soma pelo count, inclusive na raiz', () => {
    // `meta-whatsapp-module` responde `GROUP BY (flowKey, currentNodeId)`. Contando como uma sessão
    // por linha, dez conversas paradas no mesmo nó apareciam como uma — ou como nenhuma, porque a
    // linha agregada não tem `menuNodeId` para a raiz ler.
    const positions = [
      { flowKey: ROOT, nodeId: 'saudacao', count: 7 },
      { flowKey: 'sim', nodeId: 'renda', count: 3 },
    ]

    expect(countLiveByNode({ flowKey: ROOT, rootFlowKey: ROOT, positions })).toEqual({ saudacao: 7 })
    expect(countLiveByNode({ flowKey: 'sim', rootFlowKey: ROOT, positions })).toEqual({ renda: 3 })
  })

  it('os dois formatos convivem na mesma resposta', () => {
    const positions = [live({ flow: 'sim', nodeId: 'renda' }), { flowKey: 'sim', nodeId: 'renda', count: 2 }]

    expect(countLiveByNode({ flowKey: 'sim', rootFlowKey: ROOT, positions })).toEqual({ renda: 3 })
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
      menu: graph({ key: 'menu', start: 'a', nodes: [node('a'), node('o1'), node('o2'), node('o3')] }),
    }

    const positions = computeMergedLayout({ openKeys: ['menu'], graphs, primaryFlowKey: 'menu' })
    const strayX = ['o1', 'o2', 'o3'].map((id) => positions.get(`menu::${id}`)!.x)

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

    // Acontece entre o clique em "focar" e a chegada do grafo: sem isto o canvas fica em branco.
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

/**
 * O "+" cria o nó à direita de quem o criou — que é onde costuma estar o card que acabou de perder
 * a ligação. Dois cards no mesmo pixel se leem como um card só, e "sumiu" de novo.
 */
describe('findFreeSlot', () => {
  it('lugar vazio é usado como está', () => {
    expect(findFreeSlot({ desired: { x: 100, y: 0 }, taken: [] })).toEqual({ x: 100, y: 0 })
  })

  it('lugar ocupado desce até sobrar espaço, sem sair da coluna', () => {
    const slot = findFreeSlot({ desired: { x: 100, y: 0 }, taken: [{ x: 100, y: 0 }] })

    expect(slot.x).toBe(100)
    expect(slot.y).toBeGreaterThan(0)
  })

  it('desce quantas vezes precisar quando a coluna está empilhada', () => {
    const taken = [
      { x: 100, y: 0 },
      { x: 100, y: 120 },
      { x: 100, y: 240 },
    ]

    expect(findFreeSlot({ desired: { x: 100, y: 0 }, taken }).y).toBe(360)
  })

  it('card em outra coluna não empurra ninguém', () => {
    expect(findFreeSlot({ desired: { x: 100, y: 0 }, taken: [{ x: 900, y: 0 }] })).toEqual({ x: 100, y: 0 })
  })
})

/**
 * A altura do card decide o espaçamento do layout. `send_media` ganhou uma linha de saída (o motor
 * do bot anda para o `next` depois dela), e a altura tem de acompanhar — senão a camada de baixo
 * encosta no card.
 */
describe('estimateNodeHeight em nó de ação', () => {
  it('ação de passagem é mais alta que ação terminal, pela linha de saída', () => {
    const passThrough = estimateNodeHeight({ id: 'a', type: 'action', actionKind: 'send_media' })
    const terminal = estimateNodeHeight({ id: 'b', type: 'action', actionKind: 'handoff' })

    expect(passThrough).toBeGreaterThan(terminal)
  })

  it('ação sem kind conta como terminal, em vez de estourar', () => {
    expect(estimateNodeHeight({ id: 'c', type: 'action' })).toBe(
      estimateNodeHeight({ id: 'd', type: 'action', actionKind: 'handoff' }),
    )
  })
})

/**
 * A regra que o empilhamento por camada quebrava: dois cards na mesma altura fazem o fio entre eles
 * correr na horizontal, e um fio horizontal passa POR TRÁS de qualquer card que esteja no caminho.
 * Um card por linha transforma toda ligação numa diagonal curta e visível.
 */
describe('cascata: um card por linha', () => {
  it('cada card tem altura própria — ninguém divide linha com ninguém', () => {
    const graphs = {
      menu: graph({
        key: 'menu',
        start: 'a',
        nodes: [node('a', { byAnswer: { sim: 'b', nao: 'c' }, default: 'd' }), node('b'), node('c'), node('d')],
      }),
    }

    const positions = computeMergedLayout({ openKeys: ['menu'], graphs, primaryFlowKey: 'menu' })
    const ys = [...positions.values()].map((each) => each.y)

    expect(new Set(ys).size).toBe(ys.length)
  })

  it('o card seguinte fica à direita E abaixo de quem o alimenta', () => {
    const graphs = { menu: graph({ key: 'menu', start: 'a', nodes: [node('a', 'b'), node('b', 'c'), node('c')] }) }

    const positions = computeMergedLayout({ openKeys: ['menu'], graphs, primaryFlowKey: 'menu' })
    const a = positions.get('menu::a')!
    const b = positions.get('menu::b')!
    const c = positions.get('menu::c')!

    expect(b.x).toBeGreaterThan(a.x)
    expect(b.y).toBeGreaterThan(a.y)
    expect(c.x).toBeGreaterThan(b.x)
    expect(c.y).toBeGreaterThan(b.y)
  })

  it('um ramo inteiro sai antes do próximo começar — caminho de conversa não se intercala', () => {
    const graphs = {
      menu: graph({
        key: 'menu',
        start: 'a',
        nodes: [
          node('a', { byAnswer: { sim: 'b1', nao: 'c1' }, default: '' }),
          node('b1', 'b2'),
          node('b2'),
          node('c1'),
        ],
      }),
    }

    const positions = computeMergedLayout({ openKeys: ['menu'], graphs, primaryFlowKey: 'menu' })

    // b1 e b2 são o mesmo ramo: c1 (o outro ramo) só aparece depois dos dois.
    expect(positions.get('menu::b2')!.y).toBeLessThan(positions.get('menu::c1')!.y)
  })
})

/**
 * Um `next` apontando para o próprio nó não vira aresta: de A para A não há trajeto que caiba —
 * por baixo some atrás do card, por cima o cobre. Quem mostra é o ícone de repetição na linha de
 * saída. O teste existe porque "não desenhar" é fácil de perder numa refatoração de arestas.
 */
describe('laço no próprio card', () => {
  it('saída que volta ao mesmo nó não gera aresta', () => {
    const graphs = {
      menu: graph({
        key: 'menu',
        start: 'a',
        nodes: [node('a', { byAnswer: { sim: 'b' }, default: 'a' }), node('b')],
      }),
    }

    const edges = buildFlowEdges({ openKeys: ['menu'], graphs, rootFlowKey: 'menu' })

    expect(edges.map((each) => each.id)).toEqual(['menu::a->menu::b-sim'])
  })

  it('as demais saídas do mesmo card continuam desenhadas', () => {
    const graphs = {
      menu: graph({
        key: 'menu',
        start: 'a',
        nodes: [node('a', { byAnswer: { sim: 'b', repete: 'a' }, default: 'b' }), node('b')],
      }),
    }

    const edges = buildFlowEdges({ openKeys: ['menu'], graphs, rootFlowKey: 'menu' })

    expect(edges).toHaveLength(2)
    expect(edges.every((each) => each.target === 'menu::b')).toBe(true)
  })
})
