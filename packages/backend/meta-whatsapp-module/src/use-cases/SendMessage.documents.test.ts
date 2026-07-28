import { describe, expect, it } from 'bun:test'

import { SendMessageUseCase } from './SendMessage.use-case'
import type { LogMessageUseCase } from './LogMessage.use-case'
import type { DocumentRepository, LinkDocumentParams } from '../repositories/DocumentRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { MessageRow } from '../schema/schema'

const COMPANY_ID = '22222222-2222-2222-2222-222222222222'
const SESSION_ID = '11111111-1111-1111-1111-111111111111'
const MESSAGE_ID = '33333333-3333-3333-3333-333333333333'

type Options = {
  /** `undefined` do logMessage significa entrega duplicada. */
  savedMessage?: MessageRow | undefined
  withStorage?: boolean
}

function buildUseCase(options: Options = {}) {
  const linked: LinkDocumentParams[] = []
  const savedMessage =
    'savedMessage' in options ? options.savedMessage : ({ id: MESSAGE_ID, sessionId: SESSION_ID } as MessageRow)

  const channel = {
    sendMedia: async () => ({ externalMessageId: 'wamid.abc' }),
  } as never

  const sessionRepository = {
    hoursSinceLastInbound: async () => 1,
  } as unknown as SessionRepository

  const logMessage = {
    execute: async () => savedMessage,
  } as unknown as LogMessageUseCase

  const objectStorage = options.withStorage === false ? undefined : { upload: async () => ({ uploadId: 'upl_1' }) }

  const documentRepository = {
    link: async (params: LinkDocumentParams) => {
      linked.push(params)
      return undefined
    },
  } as unknown as DocumentRepository

  const useCase = new SendMessageUseCase(
    channel,
    sessionRepository,
    logMessage,
    objectStorage as never,
    documentRepository,
  )

  return { useCase, linked }
}

function sendMediaParams() {
  return {
    companyId: COMPANY_ID,
    whatsappNumber: '5511999999999',
    buffer: Buffer.from('conteudo do arquivo'),
    mimeType: 'application/pdf',
    filename: 'orcamento.pdf',
    sender: 'agent' as const,
    startState: 'greeting' as never,
  }
}

describe('SendMessageUseCase.sendMedia — biblioteca de arquivos', () => {
  it('linka o arquivo que o atendente enviou ao cliente', async () => {
    const { useCase, linked } = buildUseCase()

    await useCase.sendMedia(sendMediaParams())

    expect(linked).toHaveLength(1)
    expect(linked[0]?.source).toBe('agent')
    expect(linked[0]?.filename).toBe('orcamento.pdf')
    expect(linked[0]?.uploadId).toBe('upl_1')
    expect(linked[0]?.messageId).toBe(MESSAGE_ID)
    expect(linked[0]?.sessionId).toBe(SESSION_ID)
    // Vem do buffer, não de campo informado pelo cliente da API.
    expect(linked[0]?.sizeBytes).toBe(Buffer.from('conteudo do arquivo').length)
  })

  // Entrega duplicada: o logMessage devolve undefined e não há mensagem para vincular. Linkar aqui
  // criaria uma segunda linha no painel para o mesmo envio.
  it('não linka quando a mensagem era entrega duplicada', async () => {
    const { useCase, linked } = buildUseCase({ savedMessage: undefined })

    await useCase.sendMedia(sendMediaParams())

    expect(linked).toHaveLength(0)
  })

  // Sem storage não existe objeto para apontar, e documento sem destino é linha morta.
  it('não linka quando não há storage injetado', async () => {
    const { useCase, linked } = buildUseCase({ withStorage: false })

    await useCase.sendMedia(sendMediaParams())

    expect(linked).toHaveLength(0)
  })
})
