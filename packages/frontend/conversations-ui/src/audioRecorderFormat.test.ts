import { afterEach, describe, expect, it } from 'bun:test'

import { resolveRecordingFormat } from './AudioRecorderButton'
import { DEFAULT_ACCEPTED_FILE_TYPES } from './MessageComposer'

const originalMediaRecorder = (globalThis as Record<string, unknown>).MediaRecorder

function stubMediaRecorder(supported: readonly string[] | undefined): void {
  const stub = supported ? { isTypeSupported: (mimeType: string) => supported.includes(mimeType) } : {}
  ;(globalThis as Record<string, unknown>).MediaRecorder = stub
}

afterEach(() => {
  ;(globalThis as Record<string, unknown>).MediaRecorder = originalMediaRecorder
})

describe('resolveRecordingFormat', () => {
  it('prefere ogg/opus, que o WhatsApp aceita, sobre webm', () => {
    stubMediaRecorder(['audio/ogg;codecs=opus', 'audio/webm'])

    expect(resolveRecordingFormat()?.uploadMimeType).toBe('audio/ogg')
  })

  it('cai para mp4 no navegador que não grava ogg', () => {
    stubMediaRecorder(['audio/mp4', 'audio/webm'])

    const format = resolveRecordingFormat()
    expect(format?.uploadMimeType).toBe('audio/mp4')
    expect(format?.extension).toBe('m4a')
  })

  it('devolve indefinido quando o navegador não grava nenhum formato', () => {
    stubMediaRecorder([])

    expect(resolveRecordingFormat()).toBeUndefined()
  })

  it('devolve indefinido sem MediaRecorder no ambiente', () => {
    ;(globalThis as Record<string, unknown>).MediaRecorder = undefined

    expect(resolveRecordingFormat()).toBeUndefined()
  })
})

describe('DEFAULT_ACCEPTED_FILE_TYPES', () => {
  it('cobre Word, Excel e PowerPoint nos dois formatos, legado e OpenXML', () => {
    const accepted = DEFAULT_ACCEPTED_FILE_TYPES.split(',')

    expect(accepted).toContain('application/msword')
    expect(accepted).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(accepted).toContain('application/vnd.ms-excel')
    expect(accepted).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(accepted).toContain('application/vnd.ms-powerpoint')
    expect(accepted).toContain('application/vnd.openxmlformats-officedocument.presentationml.presentation')
  })

  it('cobre texto, PDF, áudio e vídeo, e não oferece formato que o WhatsApp recusa', () => {
    const accepted = DEFAULT_ACCEPTED_FILE_TYPES.split(',')

    expect(accepted).toContain('application/pdf')
    expect(accepted).toContain('text/plain')
    expect(accepted).toContain('audio/ogg')
    expect(accepted).toContain('video/mp4')
    expect(DEFAULT_ACCEPTED_FILE_TYPES).not.toContain('.zip')
    expect(DEFAULT_ACCEPTED_FILE_TYPES).not.toContain('.rtf')
  })
})
