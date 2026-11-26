/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Pontos do runner que o host ajusta por empresa ou conversa: pergunta de horário com faixas,
 * validador do host, textos resolvidos a cada uso e escolha digitada contra o título interpolado.
 */

import { describe, expect, it } from 'bun:test'
import type { FlowNodeData } from '@adatechnology/meta-whatsapp-contracts'
import { DEFAULT_FLOW_TEXT } from './flowRunner.constant'
import type { FlowTextContext } from './flowRunner.types'
import { COMPANY_ID, CUSTOMER, buildRunner, graph, mediaMessage, textMessage } from './flowRunnerHarness'

const TIME: FlowNodeData = {
  id: 'time',
  type: 'question',
  questionType: 'time',
  contextKey: 'time',
  question: 'Que horas?',
  validation: { minTime: '11:00', windowsContextKey: 'openWindows' },
  next: 'done',
}

const TIME_FLOW = graph('main', 'windows', [
  { id: 'windows', type: 'action', actionKind: 'load_windows', next: 'time' },
  TIME,
  { id: 'done', type: 'action', directMessage: 'Reservado às {{time}}.' },
])

function timeRunner(config: Parameters<typeof buildRunner>[0]['config'] = {}) {
  const harness = buildRunner({ graphs: [TIME_FLOW], config })
  harness.interpreter.registerFlowAction('load_windows', async () => ({
    context: { openWindows: ['11:00-14:00', '19:00-23:00'] },
  }))
  return harness
}

describe('FlowRunner — time question', () => {
  it('accepts 12h30, stores HH:MM and moves on', async () => {
    const harness = timeRunner()
    await harness.handle(textMessage('oi'))
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'Que horas?' }])

    await harness.handle(textMessage('12h30'))
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'Reservado às 12:30.' }])
    expect(harness.row.context.time).toBe('12:30')
  })

  it('re-asks outside the windows with the rejection text, then hands off', async () => {
    const harness = timeRunner({ rejectionMessages: { 'outside-allowed-windows': 'Atendemos 11h-14h e 19h-23h.' } })
    await harness.handle(textMessage('oi'))
    harness.takeSent()

    await harness.handle(textMessage('16h'))
    expect(harness.takeSent()).toEqual([
      { kind: 'text', body: 'Atendemos 11h-14h e 19h-23h.' },
      { kind: 'text', body: 'Que horas?' },
    ])
    await harness.handle(textMessage('9h'))
    expect(harness.humanRequests).toEqual([CUSTOMER])
  })
})

describe('FlowRunner — host answer validator', () => {
  it('rejects with the validator message and counts the attempt', async () => {
    const calls: unknown[] = []
    const harness = timeRunner({
      validateAnswer: async ({ value, node }) => {
        calls.push({ value, nodeId: node.id })
        return value === '12:00' ? { isValid: false, message: 'Às {{answer}} já está lotado.' } : undefined
      },
      resolveVariables: async () => ({ answer: '12h' }),
    })
    await harness.handle(textMessage('oi'))
    harness.takeSent()

    await harness.handle(textMessage('12h'))
    expect(harness.takeSent()).toEqual([
      { kind: 'text', body: 'Às 12h já está lotado.' },
      { kind: 'text', body: 'Que horas?' },
    ])
    await harness.handle(textMessage('13h'))
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'Reservado às 13:00.' }])
    expect(calls).toEqual([
      { value: '12:00', nodeId: 'time' },
      { value: '13:00', nodeId: 'time' },
    ])
  })

  it('uses rejectionMessages["rejected-by-host"] when the validator sends no message', async () => {
    const harness = timeRunner({
      validateAnswer: () => ({ isValid: false }),
      rejectionMessages: { 'rejected-by-host': 'Horário indisponível.' },
    })
    await harness.handle(textMessage('oi'))
    harness.takeSent()
    await harness.handle(textMessage('12h'))
    expect(harness.takeSent()[0]).toEqual({ kind: 'text', body: 'Horário indisponível.' })
  })

  it('accepts and reports when the validator throws', async () => {
    const harness = timeRunner({
      validateAnswer: () => {
        throw new Error('agenda offline')
      },
    })
    await harness.handle(textMessage('oi'))
    harness.takeSent()
    await harness.handle(textMessage('12h'))
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'Reservado às 12:00.' }])
    expect(harness.errors).toHaveLength(1)
  })
})

describe('FlowRunner — per-tenant text resolvers', () => {
  const ASK = graph('main', 'people', [
    {
      id: 'people',
      type: 'question',
      questionType: 'int',
      question: 'Quantas pessoas?',
      validation: { max: 8 },
      next: 'people',
    },
  ])

  it('resolves rejection, fallback and non-text texts with the conversation context', async () => {
    const seen: FlowTextContext[] = []
    const harness = buildRunner({
      graphs: [ASK],
      config: {
        maxInvalidAnswers: 5,
        rejectionMessages: {
          'above-max': (context) => {
            seen.push(context)
            return 'No máximo 8, {{contactFirstName}}.'
          },
          'invalid-format': () => undefined,
        },
        defaultFallbackMessage: async (context) => {
          seen.push(context)
          return `Não entendi (${context.companyId}).`
        },
        nonTextAnswerMessage: async () => 'Só texto, por favor.',
      },
    })
    await harness.handle(textMessage('oi'), 'Ana Souza')
    harness.takeSent()

    await harness.handle(textMessage('20'), 'Ana Souza')
    expect(harness.takeSent()[0]).toEqual({ kind: 'text', body: 'No máximo 8, Ana.' })
    await harness.handle(textMessage('muitas'), 'Ana Souza')
    expect(harness.takeSent()[0]).toEqual({ kind: 'text', body: `Não entendi (${COMPANY_ID}).` })
    await harness.handle(mediaMessage('audio'))
    expect(harness.takeSent()[0]).toEqual({ kind: 'text', body: 'Só texto, por favor.' })

    expect(seen).toEqual([
      {
        companyId: COMPANY_ID,
        whatsappNumber: CUSTOMER,
        kind: 'rejection',
        rejection: 'above-max',
        nodeId: 'people',
        flowKey: 'main',
      },
      { companyId: COMPANY_ID, whatsappNumber: CUSTOMER, kind: 'fallback', nodeId: 'people', flowKey: 'main' },
    ])
  })

  it('falls back to the package text when a resolver throws, and reports it', async () => {
    const harness = buildRunner({
      graphs: [ASK],
      config: {
        defaultFallbackMessage: () => {
          throw new Error('templates offline')
        },
      },
    })
    await harness.handle(textMessage('oi'))
    harness.takeSent()
    await harness.handle(textMessage('muitas'))
    expect(harness.takeSent()[0]).toEqual({ kind: 'text', body: DEFAULT_FLOW_TEXT.FALLBACK })
    expect(harness.errors).toHaveLength(1)
  })

  it('resolves the handoff texts per company, with the out-of-hours kind', async () => {
    const kinds: string[] = []
    const harness = buildRunner({
      graphs: [graph('main', 'handoff', [{ id: 'handoff', type: 'action', actionKind: 'handoff' }])],
      config: {
        handoff: {
          businessHours: {
            timeZone: 'America/Sao_Paulo',
            windows: [{ weekday: 1, start: '08:00', end: '09:00' }],
          },
          message: async ({ kind, companyId }) => {
            kinds.push(kind)
            return `Equipe ${companyId} avisada.`
          },
        },
      },
    })
    await harness.handle(textMessage('oi'))
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: `Equipe ${COMPANY_ID} avisada.` }])
    expect(kinds).toEqual(['handoff-out-of-hours'])
  })
})

describe('FlowRunner — typed choice against interpolated titles', () => {
  it('matches the text the customer saw, not the raw {{…}} title', async () => {
    const harness = buildRunner({
      graphs: [
        graph('main', 'menu', [
          {
            id: 'menu',
            type: 'menu',
            question: 'Escolha',
            options: [
              ['unit', '{{unitName}}'],
              ['other', 'Outra unidade'],
            ],
            next: { byAnswer: { unit: 'picked', other: 'picked' }, default: 'menu' },
          },
          { id: 'picked', type: 'action', directMessage: 'Ok!' },
        ]),
      ],
      config: { resolveVariables: async () => ({ unitName: 'Centro' }) },
    })
    await harness.handle(textMessage('oi'))
    harness.takeSent()

    await harness.handle(textMessage('centro'))
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'Ok!' }])
    expect(harness.row.currentNodeId).toBeNull()
  })

  it('keeps id and position matching', async () => {
    const harness = buildRunner({
      graphs: [
        graph('main', 'menu', [
          {
            id: 'menu',
            type: 'menu',
            question: 'Escolha',
            options: [
              ['unit', '{{unitName}}'],
              ['other', 'Outra unidade'],
            ],
            next: { byAnswer: { unit: 'a', other: 'b' }, default: 'menu' },
          },
          { id: 'a', type: 'action', directMessage: 'A' },
          { id: 'b', type: 'action', directMessage: 'B' },
        ]),
      ],
      config: { resolveVariables: async () => ({ unitName: 'Centro' }) },
    })
    await harness.handle(textMessage('oi'))
    harness.takeSent()
    await harness.handle(textMessage('2'))
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'B' }])
  })
})

describe('FlowRunner — list button label with {{…}}', () => {
  const LIST_NODE: FlowNodeData = {
    id: 'menu',
    type: 'menu',
    question: 'Escolha',
    options: [
      ['a', 'A'],
      ['b', 'B'],
      ['c', 'C'],
      ['d', 'D'],
    ],
    next: { byAnswer: { a: 'end', b: 'end', c: 'end', d: 'end' }, default: 'menu' },
  }
  const END: FlowNodeData = { id: 'end', type: 'action', directMessage: 'Ok!' }

  function listButtonLabelOf(sent: unknown): string | undefined {
    const message = sent as { kind: string; interactive?: { kind: string; buttonLabel?: string } }
    return message.kind === 'interactive' && message.interactive?.kind === 'list'
      ? message.interactive.buttonLabel
      : undefined
  }

  it('interpolates the node label with the flow variables', async () => {
    const harness = buildRunner({
      graphs: [graph('main', 'menu', [{ ...LIST_NODE, listButtonLabel: 'Horários {{unit}}' }, END])],
      config: { resolveVariables: async () => ({ unit: 'Centro' }) },
    })
    await harness.handle(textMessage('oi'))
    expect(listButtonLabelOf(harness.takeSent()[0])).toBe('Horários Centro')
  })

  it('interpolates the host default label too', async () => {
    const harness = buildRunner({
      graphs: [graph('main', 'menu', [LIST_NODE, END])],
      config: { listButtonLabel: 'Opções {{unit}}', resolveVariables: async () => ({ unit: 'Sul' }) },
    })
    await harness.handle(textMessage('oi'))
    expect(listButtonLabelOf(harness.takeSent()[0])).toBe('Opções Sul')
  })

  it('sends numbered text when the interpolated label passes the channel limit', async () => {
    const harness = buildRunner({
      graphs: [graph('main', 'menu', [{ ...LIST_NODE, listButtonLabel: 'Ver {{unit}}' }, END])],
      config: { resolveVariables: async () => ({ unit: 'Unidade com nome bem comprido' }) },
    })
    await harness.handle(textMessage('oi'))
    expect(harness.takeSent()[0]).toMatchObject({ kind: 'text' })
  })
})
