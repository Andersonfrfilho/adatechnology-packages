import { describe, expect, it } from 'bun:test'

import { AUDIO_CONTAINER, detectAudioContainer } from './audioContainer'
import { normalizeOutboundAudio, OPUS_MIME_TYPE } from './normalizeOutboundAudio'

function buildFtyp(brand: string): Buffer {
  const buffer = Buffer.alloc(32)
  buffer.writeUInt32BE(32, 0)
  buffer.write('ftyp', 4, 'latin1')
  buffer.write(brand, 8, 'latin1')
  return buffer
}

function padded(prefix: string): Buffer {
  return Buffer.concat([Buffer.from(prefix, 'latin1'), Buffer.alloc(16)])
}

describe('detectAudioContainer', () => {
  it('reconhece ogg, mpeg, amr e aac como containers próprios', () => {
    expect(detectAudioContainer(padded('OggS'))).toBe(AUDIO_CONTAINER.OGG)
    expect(detectAudioContainer(padded('ID3'))).toBe(AUDIO_CONTAINER.MPEG)
    expect(detectAudioContainer(padded('#!AMR'))).toBe(AUDIO_CONTAINER.AMR)
    expect(detectAudioContainer(Buffer.concat([Buffer.from([0xff, 0xf1]), Buffer.alloc(16)]))).toBe(
      AUDIO_CONTAINER.AAC_ADTS,
    )
  })

  it('separa o MP4 de áudio do MP4 genérico pelo brand', () => {
    expect(detectAudioContainer(buildFtyp('M4A '))).toBe(AUDIO_CONTAINER.MP4_AUDIO)
    expect(detectAudioContainer(buildFtyp('mp42'))).toBe(AUDIO_CONTAINER.MP4_AUDIO)
    // É o que o MediaRecorder do Chrome grava com `audio/mp4` — e o que a Meta recusa.
    expect(detectAudioContainer(buildFtyp('isom'))).toBe(AUDIO_CONTAINER.MP4_GENERIC)
  })

  it('reconhece webm/matroska, que o WhatsApp não aceita em nenhum caso', () => {
    expect(detectAudioContainer(Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(16)]))).toBe(
      AUDIO_CONTAINER.MATROSKA,
    )
  })

  it('não classifica buffer curto demais para ter assinatura', () => {
    expect(detectAudioContainer(Buffer.alloc(4))).toBe(AUDIO_CONTAINER.UNKNOWN)
  })
})

describe('normalizeOutboundAudio', () => {
  const transcoded = Buffer.from('OggS-convertido', 'latin1')
  const transcoder = async () => transcoded

  it('deixa passar áudio que já está em container aceito', async () => {
    const buffer = padded('OggS')
    const result = await normalizeOutboundAudio({ buffer, mimeType: 'audio/ogg', filename: 'nota.ogg', transcoder })

    expect(result.buffer).toBe(buffer)
    expect(result.mimeType).toBe('audio/ogg')
    expect(result.filename).toBe('nota.ogg')
  })

  it('converte o MP4 com brand isom que o Chrome grava, trocando mimeType e extensão', async () => {
    const result = await normalizeOutboundAudio({
      buffer: buildFtyp('isom'),
      mimeType: 'audio/mp4',
      filename: 'audio-1786924320262.m4a',
      transcoder,
    })

    expect(result.buffer).toBe(transcoded)
    expect(result.mimeType).toBe(OPUS_MIME_TYPE)
    expect(result.filename).toBe('audio-1786924320262.ogg')
  })

  it('converte webm, que nenhum navegador consegue entregar num formato aceito', async () => {
    const result = await normalizeOutboundAudio({
      buffer: Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(16)]),
      mimeType: 'audio/webm',
      filename: 'gravacao.webm',
      transcoder,
    })

    expect(result.mimeType).toBe(OPUS_MIME_TYPE)
    expect(result.filename).toBe('gravacao.ogg')
  })

  it('declara o mimeType sem parâmetro, que é o único que a Meta reconhece', () => {
    expect(OPUS_MIME_TYPE).toBe('audio/ogg')
  })

  it('não toca em mídia que não é áudio', async () => {
    const buffer = buildFtyp('isom')
    const result = await normalizeOutboundAudio({ buffer, mimeType: 'video/mp4', filename: 'clipe.mp4', transcoder })

    expect(result.buffer).toBe(buffer)
    expect(result.mimeType).toBe('video/mp4')
  })

  it('propaga a falha do transcodificador em vez de enviar o áudio recusado', async () => {
    const failing = async () => {
      throw new Error('ffmpeg indisponível')
    }

    await expect(
      normalizeOutboundAudio({
        buffer: buildFtyp('isom'),
        mimeType: 'audio/mp4',
        filename: 'a.m4a',
        transcoder: failing,
      }),
    ).rejects.toThrow('ffmpeg indisponível')
  })
})
