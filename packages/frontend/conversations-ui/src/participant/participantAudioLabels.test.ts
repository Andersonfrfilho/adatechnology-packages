import { describe, expect, it } from 'bun:test'

import { DEFAULT_PARTICIPANT_AUDIO_LABELS, formatRecordingElapsedLabel, resolveParticipantAudioLabels } from './participantAudioLabels'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'

describe('participant audio labels', () => {
  it('fills every missing key with the English default', () => {
    expect(resolveParticipantAudioLabels(undefined)).toEqual(DEFAULT_PARTICIPANT_AUDIO_LABELS)
    expect(resolveParticipantAudioLabels({ sendAudio: 'Enviar áudio' }).stopRecording).toBe('Stop recording')
    expect(resolveParticipantAudioLabels({ sendAudio: 'Enviar áudio' }).sendAudio).toBe('Enviar áudio')
  })

  it('is carried by the default map of the whole view', () => {
    for (const key of Object.keys(DEFAULT_PARTICIPANT_AUDIO_LABELS) as (keyof typeof DEFAULT_PARTICIPANT_AUDIO_LABELS)[]) {
      expect(DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS[key]).toBe(DEFAULT_PARTICIPANT_AUDIO_LABELS[key])
    }
  })

  it('fills the elapsed and limit placeholders', () => {
    expect(formatRecordingElapsedLabel('{elapsed} of {limit}', '0:12', '5:00')).toBe('0:12 of 5:00')
  })
})
