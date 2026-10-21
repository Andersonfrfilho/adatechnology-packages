import { describe, expect, it } from 'bun:test'

import type { ParticipantAttachment } from '@adatechnology/conversation-contracts'

import type { ParticipantMessageActionsTarget } from './ParticipantAuthorAvatar'
import { formatMessagesForCopy } from './participantMessageMenuModel'
import { readyTranscriptions, transcriptionFileName } from './participantTranscriptionText'

const READY = { status: 'ready', text: '  Cheguei na doca.  ', generatedAt: '2026-10-01T13:06:00.000Z' } as const

function audio(overrides: Partial<ParticipantAttachment> = {}): ParticipantAttachment {
  return {
    id: 'a1',
    kind: 'audio',
    filename: 'voz.ogg',
    mimeType: 'audio/ogg',
    sizeBytes: 10,
    transcription: READY,
    ...overrides,
  }
}

describe('transcription text', () => {
  it('keeps only ready, non-empty transcriptions of audios', () => {
    expect(readyTranscriptions([audio()])).toEqual([{ filename: 'voz.ogg', text: 'Cheguei na doca.' }])
    expect(readyTranscriptions([audio({ transcription: { status: 'pending' } })])).toEqual([])
    expect(readyTranscriptions([audio({ transcription: { ...READY, text: ' ' } })])).toEqual([])
    expect(readyTranscriptions([audio({ kind: 'document', filename: 'a.pdf' })])).toEqual([])
  })

  it('puts what was said in copies and exports, after the file name', () => {
    const message: ParticipantMessageActionsTarget = {
      id: 'm1',
      text: null,
      authorName: 'Bruno',
      isMine: false,
      attachments: [audio()],
      createdAt: '2026-10-01T13:05:00.000Z',
    }
    expect(
      formatMessagesForCopy([message], { locale: 'pt-BR', meLabel: 'Eu', transcriptionLabel: 'Transcrição' }),
    ).toMatch(/^\[01\/10\/2026 \d{2}:05\] Bruno: \[voz\.ogg\] Transcrição: Cheguei na doca\.$/)
  })

  it('names the file after the audio', () => {
    expect(transcriptionFileName('audio-motorista.ogg', 'Transcrição')).toBe('audio-motorista Transcrição.txt')
  })
})
