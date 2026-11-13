import { describe, expect, it } from 'bun:test'

import { buildRecordedFile, formatRecordedFileName } from './participantAudioCapture'

describe('recorded file naming', () => {
  it('names the file audio-YYYYMMDD-HHmmss.<ext> in UTC', () => {
    expect(formatRecordedFileName(new Date('2026-10-11T09:05:03.999Z'), 'm4a')).toBe('audio-20261011-090503.m4a')
  })

  it('keeps the upload mime type of the chosen format', () => {
    const file = buildRecordedFile(new Blob(['x']), { mimeType: 'audio/ogg;codecs=opus', uploadMimeType: 'audio/ogg', extension: 'ogg' }, new Date('2026-01-02T03:04:05Z'))
    expect(file.name).toBe('audio-20260102-030405.ogg')
    expect(file.type).toBe('audio/ogg')
  })
})
