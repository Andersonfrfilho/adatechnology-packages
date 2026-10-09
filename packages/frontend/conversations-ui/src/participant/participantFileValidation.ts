import { channelCapabilityFor } from '../channelCapability'
import type { ConversationChannel } from '../conversationChannel'

export type ParticipantFileRejection = 'tooLarge' | 'typeNotAccepted'

export type ValidateParticipantFilesParams = {
  readonly files: readonly File[]
  readonly maxBytes: number
  /** MIME types or wildcards such as `image/*`. Absent means any type. */
  readonly acceptedTypes?: readonly string[]
}

export type ValidateParticipantFilesResult = {
  readonly accepted: readonly File[]
  readonly rejection?: ParticipantFileRejection
}

function matchesAcceptedType(mimeType: string, acceptedTypes: readonly string[]): boolean {
  return acceptedTypes.some((accepted) =>
    accepted.endsWith('/*') ? mimeType.startsWith(accepted.slice(0, -1)) : mimeType === accepted,
  )
}

function rejectionOf(file: File, params: Omit<ValidateParticipantFilesParams, 'files'>): ParticipantFileRejection | undefined {
  if (params.acceptedTypes && !matchesAcceptedType(file.type, params.acceptedTypes)) return 'typeNotAccepted'
  if (file.size > params.maxBytes) return 'tooLarge'
  return undefined
}

export function validateParticipantFiles(params: ValidateParticipantFilesParams): ValidateParticipantFilesResult {
  const accepted: File[] = []
  let rejection: ParticipantFileRejection | undefined
  for (const file of params.files) {
    const reason = rejectionOf(file, params)
    if (reason === undefined) accepted.push(file)
    else rejection = rejection ?? reason
  }
  return rejection === undefined ? { accepted } : { accepted, rejection }
}

export type RejectedParticipantFile = {
  readonly file: File
  readonly reason: ParticipantFileRejection
}

export type ReduceFilesSelectionParams = {
  readonly current: readonly File[]
  readonly incoming: readonly File[]
  readonly maxBytes: number
  readonly acceptedTypes?: readonly string[]
}

export type ReduceFilesSelectionResult = {
  readonly files: readonly File[]
  readonly rejected: readonly RejectedParticipantFile[]
}

/** A refusal never drops what was already chosen: valid files are kept, refused ones are reported. */
export function reduceFilesSelection(params: ReduceFilesSelectionParams): ReduceFilesSelectionResult {
  const files = [...params.current]
  const rejected: RejectedParticipantFile[] = []
  for (const file of params.incoming) {
    const reason = rejectionOf(file, params)
    if (reason === undefined) files.push(file)
    else rejected.push({ file, reason })
  }
  return { files, rejected }
}

export function maxBytesForChannel(channel: ConversationChannel = 'app'): number {
  return channelCapabilityFor(channel).attachments.maxBytes
}
