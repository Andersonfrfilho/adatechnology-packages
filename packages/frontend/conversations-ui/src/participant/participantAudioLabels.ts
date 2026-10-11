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
  readonly audioPlayer: string
  readonly playAudio: string
  readonly pauseAudio: string
  readonly audioPosition: string
  /** Uses the `{position}` and `{duration}` placeholders; without a duration only the position is spoken. */
  readonly audioPositionValue: string
  /** Uses the `{rate}` placeholder. */
  readonly playbackRate: string
  readonly audioUnavailable: string
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
  audioPlayer: 'Audio',
  playAudio: 'Play audio',
  pauseAudio: 'Pause audio',
  audioPosition: 'Audio position',
  audioPositionValue: '{position} of {duration}',
  playbackRate: 'Playback speed {rate}',
  audioUnavailable: 'Audio unavailable',
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
