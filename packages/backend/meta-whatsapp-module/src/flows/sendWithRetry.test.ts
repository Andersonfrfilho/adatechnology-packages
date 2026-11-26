/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Retentativa do envio do robô: limite, backoff, só falha repetível, e nada reenviado do que já saiu.
 */

import { describe, expect, it } from 'bun:test'
import { WhatsAppConnectionError, WhatsAppRejectionError, WhatsAppTimeoutError } from '@adatechnology/meta-graph-core'
import type { FlowNodeData, FlowRunnerErrorDetails } from '@adatechnology/meta-whatsapp-contracts'
import { buildRunner, graph, textMessage } from './flowRunnerHarness'
import { SendRetriesExhausted, isTransientSendError, sendWithRetry } from './sendWithRetry'

const NETWORK = new WhatsAppConnectionError('ECONNRESET')

describe('isTransientSendError', () => {
  it('repeats network failures only', () => {
    expect(isTransientSendError(NETWORK)).toBe(true)
    expect(isTransientSendError(new WhatsAppTimeoutError('send'))).toBe(false)
    expect(isTransientSendError(new WhatsAppRejectionError('131000', 'x', null))).toBe(false)
    expect(isTransientSendError(new Error('db down'))).toBe(false)
  })
})

describe('sendWithRetry', () => {
  function flaky(failures: number, error: unknown = NETWORK) {
    const state = { calls: 0 }
    const send = async () => {
      state.calls += 1
      if (state.calls <= failures) throw error
    }
    return { state, send }
  }

  it('succeeds on a later attempt with exponential backoff', async () => {
    const { state, send } = flaky(2)
    const waits: number[] = []
    const result = await sendWithRetry(send, { sleep: async (ms) => void waits.push(ms) })
    expect(result.attempts).toBe(3)
    expect(state.calls).toBe(3)
    expect(waits).toEqual([500, 1000])
  })

  it('caps the delay and the number of attempts', async () => {
    const { state, send } = flaky(99)
    const waits: number[] = []
    const failure = await sendWithRetry(send, {
      maxAttempts: 4,
      baseDelayMs: 1000,
      maxDelayMs: 1500,
      sleep: async (ms) => void waits.push(ms),
    }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(SendRetriesExhausted)
    expect(failure).toMatchObject({ attempts: 4, isTransient: true, error: NETWORK })
    expect(state.calls).toBe(4)
    expect(waits).toEqual([1000, 1500, 1500])
  })

  it('does not retry a failure that is not repeatable', async () => {
    const { state, send } = flaky(1, new Error('rejected'))
    const failure = await sendWithRetry(send, { sleep: async () => {} }).catch((error: unknown) => error)
    expect(failure).toMatchObject({ attempts: 1, isTransient: false })
    expect(state.calls).toBe(1)
  })

  it('maxAttempts 1 turns retries off', async () => {
    const { state, send } = flaky(1)
    await sendWithRetry(send, { maxAttempts: 1, sleep: async () => {} }).catch(() => {})
    expect(state.calls).toBe(1)
  })

  it('lets the host decide what is repeatable', async () => {
    const { state, send } = flaky(1, new WhatsAppTimeoutError('send'))
    const result = await sendWithRetry(send, { shouldRetry: () => true, sleep: async () => {} })
    expect(result.attempts).toBe(2)
    expect(state.calls).toBe(2)
  })
})

const TWO_MESSAGES: FlowNodeData[] = [
  { id: 'hello', type: 'action', directMessage: 'Primeira', next: 'ask' },
  { id: 'ask', type: 'question', contextKey: 'name', question: 'Segunda?', next: 'end' },
  { id: 'end', type: 'action', directMessage: 'Fim' },
]

describe('FlowRunner — send retry', () => {
  const noWait = { sleep: async () => {} }

  it('retries the failed message and does not resend the one that already left', async () => {
    const harness = buildRunner({ graphs: [graph('main', 'hello', TWO_MESSAGES)], config: { sendRetry: noWait } })
    // A primeira mensagem sai; a segunda falha uma vez por rede e passa na retentativa.
    harness.failures.afterSends = 1
    harness.failures.send = 1
    harness.failures.sendError = NETWORK
    await harness.handle(textMessage('oi'))

    expect(harness.takeSent().map((message) => (message.kind === 'text' ? message.body : '?'))).toEqual([
      'Primeira',
      'Segunda?',
    ])
    expect(harness.errors).toEqual([])
    expect(harness.attempts.send).toBe(3)
  })

  it('reports attempts to the host when the retries run out', async () => {
    const harness = buildRunner({
      graphs: [graph('main', 'hello', TWO_MESSAGES)],
      config: { sendRetry: { ...noWait, maxAttempts: 3 } },
    })
    harness.failures.send = 99
    harness.failures.sendError = NETWORK
    expect(await harness.handle(textMessage('oi'))).toBe('handled')

    expect(harness.attempts.send).toBe(3)
    expect(harness.errors).toEqual([NETWORK])
    const details: FlowRunnerErrorDetails | undefined = harness.errorDetails[0]
    expect(details?.send).toEqual({ attempts: 3, messageKind: 'text', isTransient: true })
  })

  it('a non-repeatable failure is tried once and still reaches the hook with isTransient false', async () => {
    const harness = buildRunner({ graphs: [graph('main', 'hello', TWO_MESSAGES)], config: { sendRetry: noWait } })
    harness.failures.send = 1
    await harness.handle(textMessage('oi'))
    expect(harness.attempts.send).toBe(1)
    expect(harness.errorDetails[0]?.send).toEqual({ attempts: 1, messageKind: 'text', isTransient: false })
  })

  it('a retried message does not make the inbound run twice (the retry stays inside the turn)', async () => {
    const harness = buildRunner({ graphs: [graph('main', 'hello', TWO_MESSAGES)], config: { sendRetry: noWait } })
    harness.failures.send = 99
    harness.failures.sendError = NETWORK
    await harness.handle(textMessage('oi', 'wamid.1'))
    expect(await harness.handle(textMessage('oi', 'wamid.1'))).toBe('duplicate')
  })
})
