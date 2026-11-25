/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O worker da fila trata a recusa determinística da Meta como o caminho inline: entrega no hook e
 * não relança — relançar faria a fila repetir o job, rodar os hooks e reenviar o que já saiu.
 */

import { describe, expect, it } from 'bun:test'
import { WhatsAppConnectionError, WhatsAppRejectionError } from '@adatechnology/meta-graph-core'
import type { InboundEffectRejectedDescriptor, WhatsAppMessage } from '@adatechnology/meta-whatsapp-contracts'
import { InboundEffectsDispatcher, ProcessInboundDispatchUseCase, type InboundDispatchJob } from './inboundDispatch'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { SessionRow } from '../schema/schema'

const NOW = new Date()
const ROW = {
  whatsappNumber: '5511988887777',
  mode: 'bot',
  context: {},
  lastActivity: NOW,
  createdAt: NOW,
  updatedAt: NOW,
} as unknown as SessionRow
const JOB: InboundDispatchJob = {
  kind: 'message',
  companyId: 'company-1',
  message: {
    from: ROW.whatsappNumber,
    id: 'wamid.1',
    timestamp: '1',
    type: 'text',
    text: { body: 'oi' },
  } as WhatsAppMessage,
  savedMessageId: 'm1',
  receivedAt: 0,
}

function worker(failure: unknown) {
  const rejected: InboundEffectRejectedDescriptor[] = []
  const hooks = {
    onMessageReceived: async () => {
      throw failure
    },
    onInboundEffectRejected: async (details: InboundEffectRejectedDescriptor) => void rejected.push(details),
  }
  const dispatcher = new InboundEffectsDispatcher({
    sessionRepository: { getContext: async () => ROW } as unknown as SessionRepository,
    hooks,
  })
  return { useCase: new ProcessInboundDispatchUseCase(dispatcher, hooks), rejected }
}

describe('ProcessInboundDispatchUseCase — deterministic Meta rejection', () => {
  it('reports the rejection instead of rethrowing', async () => {
    const { useCase, rejected } = worker(new WhatsAppRejectionError('200', 'no permission', null))
    await useCase.execute(JOB)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]).toMatchObject({ companyId: 'company-1', kind: 'message', whatsappNumber: ROW.whatsappNumber })
  })

  it('still rethrows network failures so the queue retries', async () => {
    const { useCase, rejected } = worker(new WhatsAppConnectionError('timeout'))
    await expect(useCase.execute(JOB)).rejects.toThrow()
    expect(rejected).toEqual([])
  })
})
