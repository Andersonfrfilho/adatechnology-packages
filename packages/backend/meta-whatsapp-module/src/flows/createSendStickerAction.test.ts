import { describe, expect, it, mock } from 'bun:test'
import type { ChannelAdapterInterface, ConversationSession, FlowNodeData } from '@adatechnology/meta-whatsapp-contracts'
import { createSendStickerAction, type CreateSendStickerActionParams } from './createSendStickerAction'
import type { LogMessageParams } from '../use-cases/LogMessage.use-case'

const node: FlowNodeData = { id: 'sticker', type: 'action', actionKind: 'send_sticker' }
const session = {
  companyId: 'company-1',
  whatsappNumber: '5511900000000',
  flowKey: 'main',
} as unknown as ConversationSession
const webp = Buffer.from('RIFFwebp')

function buildHarness(overrides: Partial<CreateSendStickerActionParams> = {}) {
  const sendMedia = mock(async (_params: Parameters<ChannelAdapterInterface['sendMedia']>[0]) => ({
    externalMessageId: 'wamid.1',
  }))
  const logged: LogMessageParams[] = []
  const handler = createSendStickerAction({
    resolveSticker: async () => ({ buffer: webp, key: 'brand-v1' }),
    logMessage: { execute: async (params) => void logged.push(params) },
    startState: 'start',
    ...overrides,
  })
  const run = () =>
    handler({ node, session, channel: { sendMedia } as unknown as ChannelAdapterInterface, context: {} })
  return { run, sendMedia, logged }
}

describe('createSendStickerAction', () => {
  it('sends the webp as a sticker and logs it in the transcript', async () => {
    const harness = buildHarness()

    await harness.run()

    expect(harness.sendMedia.mock.calls[0]?.[0]).toMatchObject({
      to: '5511900000000',
      mimeType: 'image/webp',
      buffer: webp,
      asSticker: true,
    })
    expect(harness.logged[0]).toMatchObject({
      type: 'sticker',
      direction: 'outbound',
      sender: 'bot',
      waMessageId: 'wamid.1',
    })
  })

  it('stores the bytes so the panel can show the sticker', async () => {
    const upload = mock(async (_params: { buffer: Buffer; mimeType: string; key: string }) => ({
      uploadId: 'stored-1',
    }))
    const harness = buildHarness({ objectStorage: { upload } })

    await harness.run()

    expect(upload.mock.calls[0]?.[0].key).toBe('meta-whatsapp/company-1/stickers/brand-v1.webp')
    expect(harness.logged[0]?.payload).toMatchObject({ uploadId: 'stored-1', mimeType: 'image/webp' })
  })

  it('sends nothing when the host resolves no sticker', async () => {
    const harness = buildHarness({ resolveSticker: async () => undefined })

    await harness.run()

    expect(harness.sendMedia).not.toHaveBeenCalled()
    expect(harness.logged).toHaveLength(0)
  })

  it('reports the failure instead of breaking the conversation', async () => {
    const onError = mock((_error: unknown, _details: { flowKey: string | null; nodeId: string }) => undefined)
    const harness = buildHarness({ onError })
    harness.sendMedia.mockRejectedValueOnce(new Error('meta down'))

    await expect(harness.run()).resolves.toBeUndefined()

    expect(onError.mock.calls[0]?.[1]).toEqual({ flowKey: 'main', nodeId: 'sticker' })
    expect(harness.logged).toHaveLength(0)
  })
})
