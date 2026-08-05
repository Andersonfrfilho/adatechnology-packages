/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Estas funções decidem o que acontece com o fluxo que alguém desenhou, e o modo de falhar delas é
 * silencioso: aresta apontando para nó apagado não dá erro no editor — dá conversa travada no meio
 * para o cliente. Salto para nó do meio de outro fluxo não dá erro — o motor simplesmente ignora, e
 * o atendimento para sem ninguém entender.
 *
 * São puras de propósito: rodam sem navegador, sem React e sem estado, o que é exatamente o que
 * faltava enquanto elas viviam dentro de uma página de 973 linhas.
 */

import { describe, expect, it } from 'bun:test'
import type { FlowGraphData, FlowNodeData } from '@adatechnology/meta-whatsapp-contracts'

import {
  applyConnection,
  isGraphDirty,
  mergedFlowKeysFrom,
  namespaceNodeId,
  parseNamespacedId,
  removeNodeAndCleanRefs,
  resolveConnection,
} from './flowEditorOps'

/** Nó mínimo VÁLIDO pelo contrato — sem `as`, para o teste falhar se a forma do nó mudar. */
function node(id: string, next?: FlowNodeData['next']): FlowNodeData {
  return { id, type: 'question', question: id, ...(next === undefined ? {} : { next }) }
}

/**
 * Grafo mínimo VÁLIDO. `key` e `version` são obrigatórios no contrato, e sem `as` o teste passa a
 * quebrar quando o contrato ganhar campo novo — que é exatamente o drift que o comentário do
 * `flowGraph.ts` registra ter acontecido antes com o `version`.
 */
function graph(params: { key: string; start: string; nodes: FlowNodeData[] }): FlowGraphData {
  return {
    key: params.key,
    label: params.key,
    version: 1,
    startNodeId: params.start,
    nodes: Object.fromEntries(params.nodes.map((each) => [each.id, each])),
  }
}

describe('id no canvas mesclado', () => {
  it('vai e volta', () => {
    expect(parseNamespacedId(namespaceNodeId('menu', 'inicio'))).toEqual({ flowKey: 'menu', nodeId: 'inicio' })
  })

  it('nó com separador no próprio id não parte errado', () => {
    // O separador aparece no PRIMEIRO índice: um id que contenha `::` continua íntegro.
    expect(parseNamespacedId('menu::passo::dois')).toEqual({ flowKey: 'menu', nodeId: 'passo::dois' })
  })

  it('id sem prefixo devolve fluxo vazio, em vez de adivinhar', () => {
    expect(parseNamespacedId('inicio')).toEqual({ flowKey: '', nodeId: 'inicio' })
  })
})

describe('apagar nó limpa quem apontava para ele', () => {
  it('saída única que ia para o apagado fica vazia, não pendurada', () => {
    const nodes = { a: node('a', 'b'), b: node('b') }

    const result = removeNodeAndCleanRefs(nodes, 'b')

    expect(Object.keys(result)).toEqual(['a'])
    // Vazio e não `'b'`: aresta para nó inexistente trava a conversa no motor do bot.
    expect(result.a?.next).toBe('')
  })

  it('ramificação perde o destino mas MANTÉM a opção', () => {
    const nodes = {
      pergunta: node('pergunta', { byAnswer: { sim: 'aprovado', nao: 'recusado' }, default: 'aprovado' }),
      aprovado: node('aprovado'),
      recusado: node('recusado'),
    }

    const result = removeNodeAndCleanRefs(nodes, 'aprovado')
    const next = result.pergunta?.next as { byAnswer: Record<string, string>; default: string }

    // A chave `sim` continua existindo com destino vazio: removê-la esconderia da tela que a opção
    // existe e não leva a lugar nenhum, e alguém publicaria assim.
    expect(next.byAnswer).toEqual({ sim: '', nao: 'recusado' })
    expect(next.default).toBe('')
  })

  it('não mexe em quem não apontava para o apagado', () => {
    const nodes = { a: node('a', 'c'), b: node('b'), c: node('c') }

    expect(removeNodeAndCleanRefs(nodes, 'b').a?.next).toBe('c')
  })

  it('nó sem next segue sem next, e não ganha um vazio', () => {
    expect(removeNodeAndCleanRefs({ a: node('a'), b: node('b') }, 'b').a?.next).toBeUndefined()
  })
})

describe('fecho transitivo dos fluxos abertos juntos', () => {
  const graphs = {
    menu: graph({ key: 'menu', start: 'inicio', nodes: [node('inicio', 'flow:simulacao')] }),
    simulacao: graph({ key: 'simulacao', start: 's1', nodes: [node('s1', 'flow:documentos')] }),
    documentos: graph({ key: 'documentos', start: 'd1', nodes: [node('d1')] }),
    orfao: graph({ key: 'orfao', start: 'o1', nodes: [node('o1')] }),
  }

  it('alcança em profundidade e ignora quem ninguém referencia', () => {
    expect([...mergedFlowKeysFrom('menu', graphs)].sort()).toEqual(['documentos', 'menu', 'simulacao'])
  })

  it('ciclo não estoura — menu que volta ao menu é o caso mais comum que existe', () => {
    const cyclic = {
      menu: graph({ key: 'menu', start: 'i', nodes: [node('i', 'flow:sub')] }),
      sub: graph({ key: 'sub', start: 's', nodes: [node('s', 'flow:menu')] }),
    }

    expect([...mergedFlowKeysFrom('menu', cyclic)].sort()).toEqual(['menu', 'sub'])
  })

  it('referência para fluxo que não existe é ignorada em vez de abrir aba vazia', () => {
    const dangling = { menu: graph({ key: 'menu', start: 'i', nodes: [node('i', 'flow:apagado')] }) }

    expect(mergedFlowKeysFrom('menu', dangling)).toEqual(['menu'])
  })
})

describe('conectar aresta', () => {
  const graphs = {
    menu: graph({ key: 'menu', start: 'inicio', nodes: [node('inicio'), node('meio')] }),
    simulacao: graph({ key: 'simulacao', start: 's1', nodes: [node('s1'), node('s2')] }),
  }

  it('dentro do mesmo fluxo grava o id local', () => {
    const resolved = resolveConnection({
      connection: { source: 'menu::inicio', target: 'menu::meio' },
      graphs,
    })

    expect(resolved).toMatchObject({ flowKey: 'menu', nodeId: 'inicio', targetValue: 'meio' })
  })

  it('para o nó INICIAL de outro fluxo grava o salto `flow:`', () => {
    const resolved = resolveConnection({
      connection: { source: 'menu::inicio', target: 'simulacao::s1' },
      graphs,
    })

    expect(resolved?.targetValue).toBe('flow:simulacao')
  })

  it('para o MEIO de outro fluxo é RECUSADO — o motor não sabe pular para lá', () => {
    // Recusa silenciosa é melhor que gravar um salto que o bot ignora em produção: o sintoma seria
    // conversa parada, longe de quem editou.
    const resolved = resolveConnection({
      connection: { source: 'menu::inicio', target: 'simulacao::s2' },
      graphs,
    })

    expect(resolved).toBeUndefined()
  })

  it('nó em si mesmo é recusado', () => {
    expect(
      resolveConnection({ connection: { source: 'menu::inicio', target: 'menu::inicio' }, graphs }),
    ).toBeUndefined()
  })

  it('fluxo de destino inexistente é recusado', () => {
    expect(resolveConnection({ connection: { source: 'menu::inicio', target: 'sumiu::x' }, graphs })).toBeUndefined()
  })
})

describe('aplicar a conexão no nó', () => {
  it('handle `next` vira saída única', () => {
    const result = applyConnection(node('a'), { flowKey: 'menu', nodeId: 'a', handle: 'next', targetValue: 'b' })

    expect(result.next).toBe('b')
  })

  it('handle de resposta acrescenta no byAnswer e PRESERVA o resto', () => {
    const existing = node('a', { byAnswer: { sim: 'x' }, default: 'y' })

    const result = applyConnection(existing, { flowKey: 'menu', nodeId: 'a', handle: 'nao', targetValue: 'z' })
    const next = result.next as { byAnswer: Record<string, string>; default: string }

    expect(next.byAnswer).toEqual({ sim: 'x', nao: 'z' })
    // O default não pode ser perdido ao ligar um ramo: seria mudança silenciosa de comportamento.
    expect(next.default).toBe('y')
  })

  it('handle `__default` troca só o default', () => {
    const existing = node('a', { byAnswer: { sim: 'x' }, default: 'y' })

    const next = applyConnection(existing, { flowKey: 'menu', nodeId: 'a', handle: '__default', targetValue: 'z' })
      .next as { byAnswer: Record<string, string>; default: string }

    expect(next).toEqual({ byAnswer: { sim: 'x' }, default: 'z' })
  })

  it('ramificar um nó que tinha saída única não carrega a antiga como default', () => {
    // A saída única vira ramificação: o default nasce vazio, e a validação do grafo cobra. Herdar a
    // antiga faria o ramo não configurado seguir para onde o nó ia antes, sem ninguém pedir.
    const next = applyConnection(node('a', 'antigo'), {
      flowKey: 'menu',
      nodeId: 'a',
      handle: 'sim',
      targetValue: 'novo',
    }).next as { byAnswer: Record<string, string>; default: string }

    expect(next).toEqual({ byAnswer: { sim: 'novo' }, default: '' })
  })
})

describe('rascunho sujo', () => {
  const published = graph({ key: 'menu', start: 'i', nodes: [node('i', 'b'), node('b')] })

  it('igual ao publicado não está sujo', () => {
    expect(isGraphDirty(structuredClone(published), published)).toBe(false)
  })

  it('texto mudado está sujo', () => {
    const working = structuredClone(published)
    working.nodes.i!.question = 'outro'

    expect(isGraphDirty(working, published)).toBe(true)
  })

  it('posição mudada TAMBÉM está sujo — arrastar card é edição que se publica', () => {
    const working = structuredClone(published)
    working.nodes.i!.position = { x: 10, y: 20 }

    expect(isGraphDirty(working, published)).toBe(true)
  })

  it('sem rascunho ou sem publicado não está sujo, em vez de sujo por ausência', () => {
    // Durante o carregamento os dois lados chegam separados; sujo aqui faria a tela pedir
    // confirmação de descarte antes de o usuário ter tocado em nada.
    expect(isGraphDirty(undefined, published)).toBe(false)
    expect(isGraphDirty(published, undefined)).toBe(false)
  })
})
