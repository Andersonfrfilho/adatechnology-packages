import { channelCapabilityFor } from '../channelCapability'
import { resolveRecordingFormat, type RecordingFormat } from '../audioRecorderFormat'
import type { ConversationChannel } from '../conversationChannel'
import type { ParticipantAudioRecordingOptions } from './participantAudio.types'
import { matchesAcceptedType } from './participantFileValidation'

export type ComposerAudioSettings = {
  readonly audioRecording: ParticipantAudioRecordingOptions
  readonly channel: ConversationChannel
  readonly onSendAudio: (file: File) => void
}

export type ResolveComposerAudioParams = {
  readonly audioRecording?: ParticipantAudioRecordingOptions
  readonly onSendAudio?: (file: File) => void
  readonly channel?: ConversationChannel
  readonly acceptedTypes?: readonly string[]
}

/** Feature detection only: on a server there is no MediaRecorder, so it answers false. */
function resolveBrowserRecordingFormat(): RecordingFormat | undefined {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return undefined
  return resolveRecordingFormat()
}

/** The host opts in through the prop; the channel and the browser can only switch the microphone off. */
export function resolveComposerAudio(params: ResolveComposerAudioParams): ComposerAudioSettings | undefined {
  const { audioRecording, onSendAudio, channel = 'app', acceptedTypes } = params
  if (!audioRecording || !onSendAudio) return undefined
  const capability = channelCapabilityFor(channel)
  if (!capability.audio.records || !capability.attachments.accepted) return undefined
  const format = resolveBrowserRecordingFormat()
  if (!format) return undefined
  if (acceptedTypes && !matchesAcceptedType(format.uploadMimeType, acceptedTypes)) return undefined
  return { audioRecording, channel, onSendAudio }
}
