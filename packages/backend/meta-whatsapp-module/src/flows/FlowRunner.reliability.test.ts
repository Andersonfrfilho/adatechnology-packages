/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Concorrência, retentativa e fuso: o que quebra só em produção, com fila e réplicas.
 */

import { describe, expect, it } from 'bun:test'
import { ConfigMissingError, FlowRunnerError, type FlowNodeData } from '@adatechnology/meta-whatsapp-contracts'
import { buildRunner, graph, mediaMessage, replyMessage, templateButtonMessage, textMessage } from './flowRunnerHarness'
import { resolveFlowTimeZone } from './FlowRunner'
import { FLOW_RUNTIME_CONTEXT_KEY } from './flowRunner.constant'

const MENU: FlowNodeData = {
  id: 'menu',
  type: 'menu',
  question: 'Olá {{contactFirstName}}!',
  options: [
    ['book', '📅 Reservar'],
    ['human', '🙋 Atendente'],
  ],
  fallbackMessage: 'Escolha uma opção.',
  next: { byAnswer: { book: 'date', human: 'handoff' }, default: 'other' },
}

const MAIN = graph('main', 'menu', [
  MENU,
  {
    id: 'date',
    type: 'question',
    questionType: 'date',
    contextKey: 'date',
    question: 'Para qual dia?',
    validation: { minDate: 'today' },
    next: 'done',
  },
  { id: 'done', type: 'action', directMessage: 'Anotado: {{date}}.' },
  { id: 'other', type: 'action', directMessage: 'Recebi: {{menu}}.' },
  { id: 'handoff', type: 'action', actionKind: 'handoff' },
])

describe('FlowRunner — one turn per conversation', () => {
  it('serialises concurrent messages so the second answers the node the first opened', async () => {
    const harness = buildRunner({ graphs: [MAIN] })
    await Promise.all([harness.handle(textMessage('oi')), harness.handle(textMessage('1'))])
    expect(harness.takeSent().map((message) => (message.kind === 'text' ? message.body : 'menu'))).toEqual([
      'menu',
      'Para qual dia?',
    ])
    expect(harness.row.currentNodeId).toBe('date')
  })

  it('without the lock both messages read the same position (the race the lock prevents)', async () => {
    const harness = buildRunner({ graphs: [MAIN], withoutLock: true })
    await Promise.all([harness.handle(textMessage('oi')), harness.handle(textMessage('1'))])
    expect(harness.takeSent().filter((message) => message.kind === 'interactive')).toHaveLength(2)
  })
})

describe('FlowRunner — retries and failures', () => {
  it('marks the message as handled before sending, reports a send failure and ignores the retry', async () => {
    const harness = buildRunner({ graphs: [MAIN] })
    await harness.handle(textMessage('oi'))
    harness.takeSent()

    harness.failures.send = 1
    expect(await harness.handle(textMessage('1', 'wamid.retry'))).toBe('handled')
    expect(harness.errors).toHaveLength(1)
    expect(harness.row.context[FLOW_RUNTIME_CONTEXT_KEY]).toMatchObject({ lastInboundId: 'wamid.retry' })

    expect(await harness.handle(textMessage('1', 'wamid.retry'))).toBe('duplicate')
    expect(harness.takeSent()).toEqual([])
  })

  it('does not throw after the turn is saved even without an error hook', async () => {
    const harness = buildRunner({ graphs: [MAIN], withoutErrorHook: true })
    harness.failures.send = 1
    expect(await harness.handle(textMessage('oi'))).toBe('handled')
  })

  it('hands off even when the queue or its hooks fail', async () => {
    const harness = buildRunner({ graphs: [MAIN], config: { handoff: { message: 'Já chamei alguém.' } } })
    await harness.handle(textMessage('oi'))
    harness.takeSent()

    harness.failures.requestHuman = 1
    await harness.handle(replyMessage('human'))
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'Já chamei alguém.' }])
    expect(harness.errors[0]).toBeInstanceOf(Error)
  })

  it('does not re-notify the team when the same message is redelivered', async () => {
    const harness = buildRunner({ graphs: [MAIN] })
    await harness.handle(textMessage('oi'))
    const redelivered = replyMessage('human')
    await harness.handle(redelivered)
    expect(await harness.handle(redelivered)).toBe('duplicate')
    expect(harness.humanRequests).toHaveLength(1)
  })
})

describe('FlowRunner — configuration and inputs', () => {
  it('requires a time zone, or derives it from fixed business hours', () => {
    expect(() => resolveFlowTimeZone({})).toThrow(ConfigMissingError)
    expect(resolveFlowTimeZone({ handoff: { businessHours: { timeZone: 'America/Sao_Paulo', windows: [] } } })).toBe(
      'America/Sao_Paulo',
    )
  })

  it('reads "today" in the configured zone near midnight', async () => {
    // 23:30 de 25/11 em São Paulo = 02:30 de 26/11 em UTC.
    const harness = buildRunner({ graphs: [MAIN], config: { now: () => new Date('2026-11-26T02:30:00Z') } })
    await harness.handle(textMessage('oi'))
    await harness.handle(replyMessage('book'))
    await harness.handle(textMessage('hoje'))
    expect(harness.row.context['date']).toBe('2026-11-25')
  })

  it('lets host variables win over customer answers', async () => {
    const harness = buildRunner({ graphs: [MAIN] })
    harness.row.context = { contactFirstName: 'Digitado' }
    await harness.handle(textMessage('oi'), 'Ana Souza')
    expect(harness.takeSent()[0]).toMatchObject({ interactive: { body: 'Olá Ana!' } })
  })

  it("follows `default` for unmatched choices when unmatchedChoice is 'default'", async () => {
    const harness = buildRunner({
      graphs: [graph('main', 'menu', [{ ...MENU, contextKey: 'menu' }, ...Object.values(MAIN.nodes).slice(1)])],
      config: { unmatchedChoice: 'default' },
    })
    await harness.handle(textMessage('oi'))
    harness.takeSent()
    await harness.handle(textMessage('quero outra coisa'))
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'Recebi: quero outra coisa.' }])
  })

  it('accepts a template quick-reply button by its text', async () => {
    const harness = buildRunner({ graphs: [MAIN] })
    await harness.handle(textMessage('oi'))
    harness.takeSent()
    await harness.handle(templateButtonMessage('📅 Reservar'))
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'Para qual dia?' }])
  })

  it('re-asks after audio without counting an invalid attempt', async () => {
    const harness = buildRunner({ graphs: [MAIN] })
    await harness.handle(textMessage('oi'))
    harness.takeSent()
    await harness.handle(mediaMessage('audio'))
    expect(harness.takeSent()[0]).toEqual({
      kind: 'text',
      body: 'Por aqui eu entendo só texto. Pode escrever a resposta?',
    })
    expect(harness.row.context[FLOW_RUNTIME_CONTEXT_KEY]).not.toHaveProperty('invalidAnswers')
  })

  it('resets to the start flow and reports when the saved flow no longer exists', async () => {
    const harness = buildRunner({ graphs: [MAIN] })
    harness.row.flowKey = 'removed'
    harness.row.currentNodeId = 'gone'
    await harness.handle(textMessage('oi'))
    expect(harness.takeSent()[0]?.kind).toBe('interactive')
    expect(harness.row.flowKey).toBe('main')
    expect(harness.errors[0]).toBeInstanceOf(FlowRunnerError)
  })

  it('restarts by global keyword while awaiting a human, keeping the request in the queue', async () => {
    const harness = buildRunner({
      graphs: [MAIN],
      config: { globalKeywords: [{ keywords: ['menu'], target: 'restart' }] },
    })
    const requestedAt = new Date()
    harness.row.humanRequestedAt = requestedAt
    expect(await harness.handle(textMessage('oi'))).toBe('awaiting-human')
    expect(await harness.handle(textMessage('menu'))).toBe('handled')
    expect(harness.takeSent()[0]?.kind).toBe('interactive')
    expect(harness.row.humanRequestedAt).toBe(requestedAt)
  })
})
