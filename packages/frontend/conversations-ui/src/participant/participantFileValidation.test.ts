import { describe, expect, it } from 'bun:test'

import { channelCapabilityFor } from '../channelCapability'
import { maxBytesForChannel, reduceFilesSelection, validateParticipantFiles } from './participantFileValidation'

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

describe('reduceFilesSelection', () => {
  const ACCEPTED = ['image/*', 'application/pdf']

  it('keeps already chosen files and appends the valid incoming ones', () => {
    const current = [buildFile('a.jpg', 'image/jpeg', 10)]
    const incoming = [buildFile('b.pdf', 'application/pdf', 10)]
    const result = reduceFilesSelection({ current, incoming, maxBytes: 100, acceptedTypes: ACCEPTED })

    expect(result.files).toEqual([...current, ...incoming])
    expect(result.rejected).toEqual([])
  })

  it('a refusal never empties what was already chosen', () => {
    const current = [buildFile('a.jpg', 'image/jpeg', 10)]
    const big = buildFile('big.jpg', 'image/jpeg', 101)
    const sheet = buildFile('s.xls', 'application/vnd.ms-excel', 1)
    const result = reduceFilesSelection({ current, incoming: [big, sheet], maxBytes: 100, acceptedTypes: ACCEPTED })

    expect(result.files).toEqual(current)
    expect(result.rejected).toEqual([
      { file: big, reason: 'tooLarge' },
      { file: sheet, reason: 'typeNotAccepted' },
    ])
  })

  it('keeps the valid files of a mixed selection', () => {
    const good = buildFile('ok.jpg', 'image/jpeg', 10)
    const big = buildFile('big.jpg', 'image/jpeg', 101)
    const result = reduceFilesSelection({ current: [], incoming: [big, good], maxBytes: 100 })

    expect(result.files).toEqual([good])
    expect(result.rejected).toHaveLength(1)
  })

  it('takes the ceiling from the channel capability', () => {
    const twentyFiveMegabytes = 25 * 1024 * 1024
    expect(channelCapabilityFor('app').attachments.maxBytes).toBe(twentyFiveMegabytes)
    expect(channelCapabilityFor('portal').attachments.maxBytes).toBeGreaterThan(0)
    expect(maxBytesForChannel('app')).toBe(twentyFiveMegabytes)
    expect(maxBytesForChannel(undefined)).toBe(twentyFiveMegabytes)
    expect(maxBytesForChannel('portal')).toBe(channelCapabilityFor('portal').attachments.maxBytes)
  })
})
