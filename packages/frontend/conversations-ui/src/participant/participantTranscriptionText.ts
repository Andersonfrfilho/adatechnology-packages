import type { ParticipantAttachment } from '@adatechnology/conversation-contracts'

export type ReadyTranscription = { readonly filename: string; readonly text: string }

/** The audios of a message whose transcription is ready and says something, in attachment order. */
export function readyTranscriptions(attachments: readonly ParticipantAttachment[]): readonly ReadyTranscription[] {
  return attachments.flatMap((attachment) => {
    const transcription = attachment.kind === 'audio' ? attachment.transcription : undefined
    const text = transcription?.status === 'ready' ? transcription.text.trim() : ''
    return text === '' ? [] : [{ filename: attachment.filename, text }]
  })
}

/** One attachment in a copy or an export: `[file]`, followed by what was said when the audio was transcribed. */
export function attachmentForCopy(attachment: ParticipantAttachment, transcriptionLabel: string): string {
  const [ready] = readyTranscriptions([attachment])
  return ready ? `[${attachment.filename}] ${transcriptionLabel}: ${ready.text}` : `[${attachment.filename}]`
}

/** The file name of one audio's transcription: the audio's name without its extension, then the label. */
export function transcriptionFileName(audioFilename: string, transcriptionLabel: string): string {
  const base = audioFilename.replace(/\.[^.]+$/, '')
  const safe = `${base} ${transcriptionLabel}`
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `${safe}.txt`
}
