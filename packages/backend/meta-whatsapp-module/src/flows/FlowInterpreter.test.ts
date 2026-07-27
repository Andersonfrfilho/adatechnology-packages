/**
 * S-06 — paridade do vocabulário de fluxo com o que hoje é feito por nós de workflow externo.
 *
 * O motor precisa expressar, sem nenhum caso de negócio dentro do pacote, o que um workflow de
 * automação faz hoje: ramificar por condição, chamar um serviço do host, devolver o resultado
 * para o fluxo, desviar por esse resultado, capturar resposta do cliente e saltar entre grafos.
 * Cada teste abaixo trava uma dessas formas — se alguma deixar de ser expressável, migrar o bot
 * para o FlowInterpreter passa a exigir código específico do produto aqui dentro, que é
 * exatamente o que não pode acontecer.
 */

import { describe, expect, it, mock } from 'bun:test'
import type {
  ChannelAdapterInterface,
  ConversationSession,
  FlowGraphData,
  FlowNodeData,
} from '@adatechnology/meta-whatsapp-contracts'
import { FlowInterpreter, type FlowStepInput } from './FlowInterpreter'

const session = { companyId: 'company', whatsappNumber: '5511900000000' } as unknown as ConversationSession
const channel = { sendText: mock(async () => undefined) } as unknown as ChannelAdapterInterface

function graphOf(nodes: FlowNodeData[]): FlowGraphData {
  return {
    key: 'test',
    label: 'Test',
    version: 1,
    startNodeId: nodes[0]!.id,
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
  }
}

function inputOf(graph: FlowGraphData, overrides: Partial<FlowStepInput> = {}): FlowStepInput {
  return { graph, currentNodeId: graph.startNodeId, context: {}, session, channel, ...overrides }
}

describe('nó de condição', () => {
  const graph = graphOf([
    {
      id: 'needsSimulation',
      type: 'condition',
      conditionContextKey: 'amount',
      conditionOperator: '>=',
      conditionValue: '100000',
      next: { byAnswer: { true: 'simulate', false: 'goodbye' }, default: 'goodbye' },
    },
    { id: 'simulate', type: 'question', question: 'Simulando...' },
    { id: 'goodbye', type: 'question', question: 'Até logo' },
  ])

  it('segue o ramo verdadeiro', async () => {
    const result = await new FlowInterpreter().step(inputOf(graph, { context: { amount: 350000 } }))
    expect(result).toMatchObject({ kind: 'advanced', nodeId: 'simulate' })
  })

  it('segue o ramo falso', async () => {
    const result = await new FlowInterpreter().step(inputOf(graph, { context: { amount: 1000 } }))
    expect(result).toMatchObject({ kind: 'advanced', nodeId: 'goodbye' })
  })

  // Chave ausente não é o mesmo que comparação falsa por valor, mas o efeito precisa ser o ramo
  // falso — nunca uma exceção que derrubaria o processamento do webhook.
  it('cai no ramo falso quando a chave não está no contexto', async () => {
    const result = await new FlowInterpreter().step(inputOf(graph))
    expect(result).toMatchObject({ kind: 'advanced', nodeId: 'goodbye' })
  })
})

describe('nó de ação', () => {
  const graph = graphOf([
    {
      id: 'callService',
      type: 'action',
      actionKind: 'call_host_service',
      actionParams: { endpoint: 'simulations', bank: 'CAIXA' },
      next: 'done',
    },
    { id: 'done', type: 'question', question: 'Pronto' },
    { id: 'rejected', type: 'question', question: 'Não deu' },
  ])

  it('entrega ao handler os parâmetros declarados no nó', async () => {
    const interpreter = new FlowInterpreter()
    let received: Record<string, unknown> | undefined
    interpreter.registerFlowAction('call_host_service', async ({ node }) => {
      received = node.actionParams
    })

    await interpreter.step(inputOf(graph))

    expect(received).toEqual({ endpoint: 'simulations', bank: 'CAIXA' })
  })

  // Sem isto, uma ação que produz dado não teria como devolvê-lo ao fluxo e os nós seguintes não
  // poderiam condicionar nem exibir o resultado.
  it('mescla no contexto o que o handler devolve', async () => {
    const interpreter = new FlowInterpreter()
    interpreter.registerFlowAction('call_host_service', async () => ({ context: { installment: 2500 } }))

    const result = await interpreter.step(inputOf(graph, { context: { amount: 350000 } }))

    expect(result.context).toEqual({ amount: 350000, installment: 2500 })
  })

  it('deixa o handler desviar o fluxo, ignorando o next do grafo', async () => {
    const interpreter = new FlowInterpreter()
    interpreter.registerFlowAction('call_host_service', async () => ({ next: 'rejected' }))

    const result = await interpreter.step(inputOf(graph))

    expect(result).toMatchObject({ kind: 'advanced', nodeId: 'rejected' })
  })

  // actionKind sem handler é grafo publicado com ação que o host não registrou. Encerrar é o
  // comportamento seguro: seguir o `next` faria a conversa passar adiante como se a ação
  // tivesse acontecido.
  it('encerra quando não há handler registrado', async () => {
    const result = await new FlowInterpreter().step(inputOf(graph))
    expect(result.kind).toBe('terminal')
  })
})

describe('nó de pergunta', () => {
  const graph = graphOf([
    { id: 'askName', type: 'question', questionType: 'text', contextKey: 'name', question: 'Nome?', next: 'end' },
    { id: 'end', type: 'question', question: 'Fim' },
  ])

  it('aguarda sem avançar enquanto não há resposta', async () => {
    const result = await new FlowInterpreter().step(inputOf(graph))
    expect(result).toMatchObject({ kind: 'awaiting-answer', nodeId: 'askName' })
  })

  it('grava a resposta na chave declarada e avança', async () => {
    const result = await new FlowInterpreter().step(inputOf(graph, { userAnswer: 'Maria' }))
    expect(result).toMatchObject({ kind: 'advanced', nodeId: 'end' })
    expect(result.context).toEqual({ name: 'Maria' })
  })
})

describe('menu', () => {
  const graph = graphOf([
    {
      id: 'menu',
      type: 'menu',
      contextKey: 'choice',
      options: [
        ['1', 'Imobiliário'],
        ['2', 'Veículo'],
      ],
      next: { byAnswer: { '1': 'property', '2': 'vehicle' }, default: 'property' },
    },
    { id: 'property', type: 'question', question: 'Imóvel' },
    { id: 'vehicle', type: 'question', question: 'Veículo' },
  ])

  it('roteia pela opção escolhida', async () => {
    const result = await new FlowInterpreter().step(inputOf(graph, { userAnswer: '2' }))
    expect(result).toMatchObject({ kind: 'advanced', nodeId: 'vehicle' })
  })

  it('cai no default quando a opção não existe', async () => {
    const result = await new FlowInterpreter().step(inputOf(graph, { userAnswer: '9' }))
    expect(result).toMatchObject({ kind: 'advanced', nodeId: 'property' })
  })
})

describe('run — percurso completo', () => {
  // O caminho que hoje é uma sequência de nós de workflow: pergunta do cliente, chamada de
  // serviço do host, ramificação pelo resultado.
  const graph = graphOf([
    {
      id: 'askAmount',
      type: 'question',
      questionType: 'money',
      contextKey: 'amount',
      question: 'Valor?',
      next: 'simulate',
    },
    { id: 'simulate', type: 'action', actionKind: 'call_host_service', next: 'checkApproval' },
    {
      id: 'checkApproval',
      type: 'condition',
      conditionContextKey: 'approved',
      conditionOperator: '==',
      conditionValue: 'true',
      next: { byAnswer: { true: 'approved', false: 'denied' }, default: 'denied' },
    },
    { id: 'approved', type: 'question', question: 'Aprovado' },
    { id: 'denied', type: 'question', question: 'Negado' },
  ])

  it('atravessa pergunta, ação e condição numa só chamada', async () => {
    const interpreter = new FlowInterpreter()
    interpreter.registerFlowAction('call_host_service', async ({ context }) => ({
      context: { approved: String(Number(context.amount) <= 500000) },
    }))

    const result = await interpreter.run(inputOf(graph, { userAnswer: '350000' }))

    expect(result.kind).toBe('awaiting-answer')
    expect(result.visited).toEqual(['askAmount', 'simulate', 'checkApproval', 'approved'])
    expect(result.context).toMatchObject({ amount: '350000', approved: 'true' })
  })

  // A resposta do cliente vale só para a pergunta que a pediu. Se ela sobrevivesse ao laço, cada
  // pergunta seguinte seria respondida sozinha e a conversa pularia etapas.
  it('não reaplica a resposta do cliente nos nós seguintes', async () => {
    const twoQuestions = graphOf([
      { id: 'first', type: 'question', contextKey: 'first', question: 'A?', next: 'second' },
      { id: 'second', type: 'question', contextKey: 'second', question: 'B?', next: 'end' },
      { id: 'end', type: 'question', question: 'Fim' },
    ])

    const result = await new FlowInterpreter().run(inputOf(twoQuestions, { userAnswer: 'x' }))

    expect(result).toMatchObject({ kind: 'awaiting-answer', nodeId: 'second' })
    expect(result.context).toEqual({ first: 'x' })
  })

  it('salta para outro grafo pelo prefixo de cross-flow', async () => {
    const crossFlow = graphOf([
      { id: 'jump', type: 'question', contextKey: 'answer', question: 'A?', next: 'flow:outro' },
    ])

    const result = await new FlowInterpreter().run(inputOf(crossFlow, { userAnswer: 'x' }))

    expect(result).toMatchObject({ kind: 'cross-flow', flowKey: 'outro' })
  })

  // Ciclo de nós automáticos é grafo publicável (o validador do editor detecta nó inalcançável,
  // não ciclo). O runtime precisa sobreviver a ele em vez de travar quem atende o webhook.
  it('corta ciclo de condições em vez de travar', async () => {
    const cycle = graphOf([
      { id: 'a', type: 'condition', conditionContextKey: 'k', conditionOperator: '==', conditionValue: 'v', next: 'b' },
      { id: 'b', type: 'condition', conditionContextKey: 'k', conditionOperator: '==', conditionValue: 'v', next: 'a' },
    ])

    const result = await new FlowInterpreter().run(inputOf(cycle), { maxSteps: 10 })

    expect(result.kind).toBe('max-steps-exceeded')
    expect(result.steps).toBe(10)
  })
})
