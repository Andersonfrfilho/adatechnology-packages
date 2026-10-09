import { describe, expect, it } from 'bun:test'

import { validateParticipantFiles } from './participantFileValidation'

function buildFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

describe('validateParticipantFiles', () => {
  it('accepts files within the size limit and accepted types', () => {
    const photo = buildFile('photo.jpg', 'image/jpeg', 10)
    const result = validateParticipantFiles({ files: [photo], maxBytes: 100, acceptedTypes: ['image/*'] })

    expect(result.accepted).toEqual([photo])
    expect(result.rejection).toBeUndefined()
  })

  it('rejects a file above maxBytes with tooLarge and keeps the valid ones', () => {
    const small = buildFile('a.jpg', 'image/jpeg', 10)
    const big = buildFile('b.jpg', 'image/jpeg', 101)
    const result = validateParticipantFiles({ files: [small, big], maxBytes: 100 })

    expect(result.accepted).toEqual([small])
    expect(result.rejection).toBe('tooLarge')
  })

  it('rejects a type outside acceptedTypes, by exact type or wildcard', () => {
    const sheet = buildFile('a.xls', 'application/vnd.ms-excel', 1)
    const pdf = buildFile('a.pdf', 'application/pdf', 1)
    const result = validateParticipantFiles({ files: [sheet, pdf], maxBytes: 100, acceptedTypes: ['image/*', 'application/pdf'] })

    expect(result.accepted).toEqual([pdf])
    expect(result.rejection).toBe('typeNotAccepted')
  })

  it('accepts any type when acceptedTypes is absent', () => {
    const any = buildFile('a.bin', '', 1)

    expect(validateParticipantFiles({ files: [any], maxBytes: 100 }).accepted).toEqual([any])
  })
})
