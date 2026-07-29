/**
 * A action `send_media` é a única built-in que o pacote implementa de ponta a ponta, então o que
 * ela promete tem de estar travado aqui: ordem de envio, filtro de ativos, e — o principal — que
 * a falha de um arquivo não trave a conversa num nó automático.
 */

import { describe, expect, it, mock } from 'bun:test'
import type { ChannelAdapterInterface, ConversationSession, FlowNodeData } from '@adatechnology/meta-whatsapp-contracts'
import {
  createSendMediaAction,
  type CreateSendMediaActionParams,
  type FlowMediaTranscriptLogger,
} from './createSendMediaAction'
import type { FlowMediaRepository } from '../repositories/FlowMediaRepository'
import type { LogMessageParams, LogMessageUseCase } from '../use-cases/LogMessage.use-case'
import type { FlowMediaRow } from '../schema/schema'

const node: FlowNodeData = { id: 'materiais', type: 'action', actionKind: 'send_media' }

const session = {
  companyId: 'company-1',
  whatsappNumber: '5511900000000',
  flowKey: 'consorcio',
} as unknown as ConversationSession

function attachmentOf(overrides: Partial<FlowMediaRow>): FlowMediaRow {
  return {
    id: 'media-1',
    companyId: 'company-1',
    flowKey: 'consorcio',
    nodeId: 'materiais',
    uploadId: 'upload-1',
    filename: 'tabela.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    caption: null,
    sortOrder: 0,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as FlowMediaRow
}

type SendMediaParams = Parameters<ChannelAdapterInterface['sendMedia']>[0]
type StorageStub = CreateSendMediaActionParams['objectStorage']

// Só `getObject` importa aqui; o cast evita encher cada teste com stubs de upload/getDownloadUrl
// que a action nunca chama.
const storageOf = (getObject: (uploadId: string) => Promise<Buffer>): StorageStub =>
  ({ getObject }) as unknown as StorageStub

// Tipo no `mock<>` e não em parâmetro nomeado: a função não usa o argumento, e nomeá-lo só para
// tipar `mock.calls` deixaria variável morta. O tipo é o que faz as asserções abaixo checarem.
const sendMediaMock = () =>
  mock<(params: SendMediaParams) => Promise<{ externalMessageId: string }>>(async () => ({
    externalMessageId: 'wamid.1',
  }))

function harness(attachments: FlowMediaRow[]) {
  const sendMedia = sendMediaMock()
  const logExecute = mock<(params: Parameters<LogMessageUseCase['execute']>[0]) => Promise<undefined>>(
    async () => undefined,
  )

  const handler = createSendMediaAction({
    flowMediaRepository: { listActive: mock(async () => attachments) } as unknown as FlowMediaRepository,
    objectStorage: storageOf(async () => Buffer.from('bytes')),
    logMessage: { execute: logExecute } as unknown as LogMessageUseCase,
    startState: 'start',
  })

  return { handler, sendMedia, logExecute }
}

const invoke = (handler: ReturnType<typeof createSendMediaAction>, channel: ChannelAdapterInterface) =>
  handler({ node, session, channel, context: {} })

describe('createSendMediaAction', () => {
  it('envia os anexos do nó na ordem em que a biblioteca devolveu', async () => {
    const { handler, sendMedia } = harness([
      attachmentOf({ id: 'media-1', uploadId: 'upload-1', filename: 'tabela.pdf', sortOrder: 0 }),
      attachmentOf({
        id: 'media-2',
        uploadId: 'upload-2',
        filename: 'folder.jpg',
        mimeType: 'image/jpeg',
        sortOrder: 1,
      }),
    ])
    const channel = { sendMedia } as unknown as ChannelAdapterInterface

    await invoke(handler, channel)

    expect(sendMedia).toHaveBeenCalledTimes(2)
    expect(sendMedia.mock.calls[0]![0]).toMatchObject({ filename: 'tabela.pdf', to: '5511900000000' })
    expect(sendMedia.mock.calls[1]![0]).toMatchObject({ filename: 'folder.jpg' })
  })

  it('registra o envio no transcript com o uploadId da biblioteca', async () => {
    const { handler, sendMedia, logExecute } = harness([attachmentOf({ caption: 'Nossa tabela' })])
    const channel = { sendMedia } as unknown as ChannelAdapterInterface

    await invoke(handler, channel)

    expect(logExecute.mock.calls[0]![0]).toMatchObject({
      direction: 'outbound',
      sender: 'bot',
      type: 'document',
      content: 'Nossa tabela',
      payload: { uploadId: 'upload-1', flowMediaId: 'media-1' },
    })
  })

  // Um PDF que não subiu não pode deixar o cliente parado num nó que não pede resposta.
  it('segue para o próximo arquivo quando um falha, e reporta pelo onError', async () => {
    const onError = mock<(error: unknown, details: { flowKey: string; nodeId: string; uploadId: string }) => undefined>(
      () => undefined,
    )
    const sendMedia = sendMediaMock()
    const channel = { sendMedia } as unknown as ChannelAdapterInterface

    const handler = createSendMediaAction({
      flowMediaRepository: {
        listActive: mock(async () => [
          attachmentOf({ id: 'media-1', uploadId: 'upload-1' }),
          attachmentOf({ id: 'media-2', uploadId: 'upload-2', filename: 'folder.jpg' }),
        ]),
      } as unknown as FlowMediaRepository,
      objectStorage: storageOf(async (uploadId) => {
        if (uploadId === 'upload-1') throw new Error('storage fora do ar')
        return Buffer.from('bytes')
      }),
      logMessage: { execute: mock(async () => undefined) } as unknown as LogMessageUseCase,
      startState: 'start',
      onError,
    })

    await expect(handler({ node, session, channel, context: {} })).resolves.toBeUndefined()

    expect(sendMedia).toHaveBeenCalledTimes(1)
    expect(sendMedia.mock.calls[0]![0]).toMatchObject({ filename: 'folder.jpg' })
    expect(onError.mock.calls[0]![1]).toMatchObject({ flowKey: 'consorcio', nodeId: 'materiais', uploadId: 'upload-1' })
  })

  // Host em migração: o transcript ainda é o dele, então o que ele tem para oferecer é um objeto
  // com `execute`, não a instância de LogMessageUseCase. Sem cast nenhum neste teste de propósito —
  // é a compilação dele que garante que a action continua utilizável fora do módulo completo.
  it('aceita qualquer logger com execute, sem exigir a classe do módulo', async () => {
    const registrado: LogMessageParams[] = []
    const logger: FlowMediaTranscriptLogger = {
      execute: async (params) => {
        registrado.push(params)
        return { id: 'mensagem-do-host' }
      },
    }
    const sendMedia = sendMediaMock()

    const handler = createSendMediaAction({
      flowMediaRepository: {
        listActive: mock(async () => [attachmentOf({})]),
      } as unknown as FlowMediaRepository,
      objectStorage: storageOf(async () => Buffer.from('bytes')),
      logMessage: logger,
      startState: 'start',
    })

    await handler({ node, session, channel: { sendMedia } as unknown as ChannelAdapterInterface, context: {} })

    expect(registrado[0]).toMatchObject({ direction: 'outbound', payload: { uploadId: 'upload-1' } })
  })

  // Conversa fora de fluxo não tem de onde ler a biblioteca — não pode explodir nem inventar chave.
  it('não envia nada quando a sessão está fora de um fluxo', async () => {
    const { handler, sendMedia } = harness([attachmentOf({})])
    const channel = { sendMedia } as unknown as ChannelAdapterInterface

    await handler({
      node,
      session: { ...session, flowKey: null } as unknown as ConversationSession,
      channel,
      context: {},
    })

    expect(sendMedia).not.toHaveBeenCalled()
  })
})
