import { describe, expect, it } from 'bun:test'

import type { ParticipantAttachment } from '@adatechnology/conversation-contracts'

import type { ParticipantConversationsApi } from './participantApi.types'
import { bindAttachmentUrlResolver } from './bindAttachmentUrlResolver'

class ClassAdapter {
  readonly baseUrl = 'https://files.example'

  async resolveAttachmentUrl(attachment: ParticipantAttachment, disposition: 'inline' | 'attachment' = 'inline'): Promise<string> {
    return `${this.baseUrl}/${attachment.id}?disposition=${disposition}`
  }
}

describe('bindAttachmentUrlResolver', () => {
  it('keeps the adapter as this, which a detached method reference would lose', async () => {
    const adapter = new ClassAdapter()
    const attachment: ParticipantAttachment = { id: 'a1', kind: 'image', filename: 'a.png', mimeType: 'image/png', sizeBytes: 1 }
    const resolve = bindAttachmentUrlResolver(adapter as unknown as ParticipantConversationsApi)

    expect(await resolve(attachment, 'attachment')).toBe('https://files.example/a1?disposition=attachment')
    expect(await resolve(attachment)).toBe('https://files.example/a1?disposition=inline')
  })
})
