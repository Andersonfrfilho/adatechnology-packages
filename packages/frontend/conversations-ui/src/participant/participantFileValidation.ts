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

function rejectionOf(file: File, params: ValidateParticipantFilesParams): ParticipantFileRejection | undefined {
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
