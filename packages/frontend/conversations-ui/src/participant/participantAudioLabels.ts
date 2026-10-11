import type { ParticipantConversationsLabels } from './participantLabels'

export type ParticipantAudioLabels = {
  readonly recordAudio: string
  readonly recordingInProgress: string
  readonly stopRecording: string
  /** Uses the `{elapsed}` and `{limit}` placeholders. */
  readonly recordingElapsed: string
  readonly reviewAudio: string
  readonly sendAudio: string
  readonly discardAudio: string
  readonly microphoneDenied: string
  readonly recordingUnsupported: string
  readonly audioEmpty: string
  readonly audioTooLarge: string
}

export const DEFAULT_PARTICIPANT_AUDIO_LABELS: ParticipantAudioLabels = {
  recordAudio: 'Record audio',
  recordingInProgress: 'Recording',
  stopRecording: 'Stop recording',
  recordingElapsed: '{elapsed} of {limit}',
  reviewAudio: 'Listen before sending',
  sendAudio: 'Send audio',
  discardAudio: 'Discard audio',
  microphoneDenied: 'No permission to use the microphone.',
  recordingUnsupported: 'This device cannot record audio.',
  audioEmpty: 'Nothing was captured by the microphone.',
  audioTooLarge: 'Audio too large to send.',
}

export function resolveParticipantAudioLabels(
  labels: Partial<ParticipantAudioLabels> | ParticipantConversationsLabels | undefined,
): ParticipantAudioLabels {
  const resolved = { ...DEFAULT_PARTICIPANT_AUDIO_LABELS }
  for (const key of Object.keys(resolved) as (keyof ParticipantAudioLabels)[]) {
    resolved[key] = labels?.[key] ?? DEFAULT_PARTICIPANT_AUDIO_LABELS[key]
  }
  return resolved
}

export function formatRecordingElapsedLabel(template: string, elapsed: string, limit: string): string {
  return template.replace('{elapsed}', elapsed).replace('{limit}', limit)
}
