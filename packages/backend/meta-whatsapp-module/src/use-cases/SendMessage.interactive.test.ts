import { describe, expect, it } from 'bun:test'
import { InteractiveLimitExceededError, WindowExpiredError } from '@adatechnology/meta-whatsapp-contracts'
import type { ChannelAdapterInterface, InteractiveMessage } from '@adatechnology/meta-whatsapp-contracts'

import { DEFAULT_FALLBACK_LIST_LABEL, SendMessageUseCase } from './SendMessage.use-case'
import type { LogMessageParams, LogMessageUseCase } from './LogMessage.use-case'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { MessageRow } from '../schema/schema'
import { RecordingChannelAdapter } from '../testing/RecordingChannelAdapter'

const COMPANY_ID = '22222222-2222-2222-2222-222222222222'

function buildUseCase(options: { hoursSinceLastInbound?: number | undefined; channel?: ChannelAdapterInterface } = {}) {
  const logged: LogMessageParams[] = []
  const channel = options.channel ?? new RecordingChannelAdapter()
  const sessionRepository = {
    hoursSinceLastInbound: async () => ('hoursSinceLastInbound' in options ? options.hoursSinceLastInbound : 1),
  } as unknown as SessionRepository
  const logMessage = {
    execute: async (params: LogMessageParams) => {
      logged.push(params)
      return { id: 'msg-1' } as MessageRow
    },
  } as unknown as LogMessageUseCase
  return { useCase: new SendMessageUseCase(channel, sessionRepository, logMessage), logged, channel }
}

function params(interactive: InteractiveMessage) {
  return {
    companyId: COMPANY_ID,
    whatsappNumber: '5511999990000',
    interactive,
    sender: 'bot' as const,
    startState: 'start',
  }
}

const LIST: InteractiveMessage = {
  kind: 'list',
  body: 'Qual horário?',
  buttonLabel: 'Ver horários',
  sections: [
    { title: 'Manhã', rows: [{ id: 'm9', title: '09:00', description: 'Sala 1' }] },
    { title: 'Tarde', rows: [{ id: 't14', title: '14:00' }] },
  ],
}

describe('SendMessageUseCase.sendInteractive', () => {
  it('envia a lista com seções e grava o histórico com as opções oferecidas', async () => {
    const { useCase, logged, channel } = buildUseCase()

    await useCase.sendInteractive(params(LIST))

    expect((channel as RecordingChannelAdapter).sent[0]).toMatchObject({
      kind: 'interactive-list',
      params: { to: '5511999990000', body: 'Qual horário?', buttonLabel: 'Ver horários', sections: LIST.sections },
    })
    expect(logged[0]).toMatchObject({
      direction: 'outbound',
      sender: 'bot',
      type: 'interactive',
      content: 'Qual horário?',
      payload: { interactive: LIST },
      waMessageId: 'sandbox.1',
      status: 'sent',
    })
  })

  it('envia botões pelo método de botão quando o canal tem', async () => {
    const { useCase, channel } = buildUseCase()

    await useCase.sendInteractive(
      params({ kind: 'buttons', body: 'Confirma?', buttons: [{ id: 'sim', title: '✅ Sim' }] }),
    )

    expect((channel as RecordingChannelAdapter).sent[0]?.kind).toBe('interactive-buttons')
  })

  it('canal sem botão: os botões saem como lista', async () => {
    const lists: unknown[] = []
    const channel = {
      sendInteractiveList: async (sent: unknown) => {
        lists.push(sent)
        return { externalMessageId: 'wamid.1' }
      },
    } as unknown as ChannelAdapterInterface
    const { useCase } = buildUseCase({ channel })

    await useCase.sendInteractive(
      params({ kind: 'buttons', body: 'Confirma?', buttons: [{ id: 'sim', title: 'Sim' }] }),
    )

    expect(lists[0]).toEqual({
      to: '5511999990000',
      body: 'Confirma?',
      buttonLabel: DEFAULT_FALLBACK_LIST_LABEL,
      rows: [{ id: 'sim', title: 'Sim' }],
    })
  })

  it('fora dos limites: erro tipado antes da janela e da rede', async () => {
    const { useCase, logged, channel } = buildUseCase({ hoursSinceLastInbound: undefined })

    const tooLong: InteractiveMessage = { ...LIST, kind: 'list', buttonLabel: 'x'.repeat(21) }
    await expect(useCase.sendInteractive(params(tooLong))).rejects.toBeInstanceOf(InteractiveLimitExceededError)

    expect((channel as RecordingChannelAdapter).sent).toEqual([])
    expect(logged).toEqual([])
  })

  it('janela fechada: WindowExpiredError, nada enviado', async () => {
    const { useCase, channel } = buildUseCase({ hoursSinceLastInbound: 30 })

    await expect(useCase.sendInteractive(params(LIST))).rejects.toBeInstanceOf(WindowExpiredError)
    expect((channel as RecordingChannelAdapter).sent).toEqual([])
  })
})
