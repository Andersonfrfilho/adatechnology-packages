import { describe, expect, it } from 'bun:test'

import type { ParticipantAttachment, ParticipantTranscription } from './index'

describe('the /participant entry re-exports the transcription type next to ParticipantAttachment', () => {
  it('lets a host type the field without importing the contracts package (checked by tsc)', () => {
    const transcription: ParticipantTranscription = { status: 'pending' }
    const attachment: Pick<ParticipantAttachment, 'transcription'> = { transcription }
    expect(attachment.transcription?.status).toBe('pending')
  })
})
