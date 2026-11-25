/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import type { MessageHookOutcome, WhatsAppMessage } from '@adatechnology/meta-whatsapp-contracts'
import { InboundEffectsDispatcher } from './inboundDispatch'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { SessionRow } from '../schema/schema'

const MESSAGE = {
  from: '5511999990000',
  id: 'wamid.1',
  timestamp: '1',
  type: 'text',
  text: { body: 'oi' },
} as WhatsAppMessage

function dispatcherWith(params: { outcome?: MessageHookOutcome; mode?: string; hasRunner?: boolean }) {
  const handled: unknown[] = []
  const now = new Date()
  const row = {
    whatsappNumber: MESSAGE.from,
    mode: params.mode ?? 'bot',
    context: {},
    lastActivity: now,
    createdAt: now,
    updatedAt: now,
  } as unknown as SessionRow
  const dispatcher = new InboundEffectsDispatcher({
    sessionRepository: { getContext: async () => row } as unknown as SessionRepository,
    ...(params.outcome ? { hooks: { onMessageReceived: async () => params.outcome! } } : {}),
    ...(params.hasRunner === false
      ? {}
      : {
          flowRunner: {
            handle: async (input: unknown) => {
              handled.push(input)
              return 'handled' as const
            },
          },
        }),
  })
  const run = () =>
    dispatcher.runMessageEffects({
      kind: 'message',
      companyId: 'c',
      message: MESSAGE,
      savedMessageId: 'm',
      profileName: 'Ana',
      receivedAt: 0,
    })
  return { run, handled }
}

describe('InboundEffectsDispatcher — flow runner', () => {
  it('runs the flow when the host hook continues, passing the profile name', async () => {
    const { run, handled } = dispatcherWith({ outcome: { outcome: 'continue' } })
    await run()
    expect(handled).toEqual([{ companyId: 'c', message: MESSAGE, profileName: 'Ana' }])
  })

  it('runs the flow when there is no hook', async () => {
    const { run, handled } = dispatcherWith({})
    await run()
    expect(handled).toHaveLength(1)
  })

  it('does not run the flow when the host handled the message or a human is attending', async () => {
    const handledByHost = dispatcherWith({ outcome: { outcome: 'handled' } })
    await handledByHost.run()
    const humanMode = dispatcherWith({ outcome: { outcome: 'continue' }, mode: 'human' })
    await humanMode.run()
    expect(handledByHost.handled).toEqual([])
    expect(humanMode.handled).toEqual([])
  })
})
