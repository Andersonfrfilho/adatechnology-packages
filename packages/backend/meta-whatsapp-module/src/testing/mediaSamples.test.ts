import { describe, expect, it } from 'bun:test'

import { MEDIA_SAMPLES, findMediaSample, readMediaSample, type MediaSampleName } from './mediaSamples'

/**
 * Assinatura no início do arquivo, por formato. É o que separa "amostra" de "placeholder": sem
 * isso, trocar o conteúdo por texto qualquer continuaria passando em tudo, e o defeito só
 * apareceria quando alguém tentasse abrir o arquivo.
 */
const MAGIC_BYTES: Readonly<Record<MediaSampleName, readonly number[]>> = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  docx: [0x50, 0x4b, 0x03, 0x04], // zip — OOXML é um zip
  xlsx: [0x50, 0x4b, 0x03, 0x04],
  zip: [0x50, 0x4b, 0x03, 0x04],
  png: [0x89, 0x50, 0x4e, 0x47],
  jpeg: [0xff, 0xd8, 0xff],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF
  mp4: [0x00, 0x00, 0x00],
  ogg: [0x4f, 0x67, 0x67, 0x53], // OggS
  m4a: [0x00, 0x00, 0x00],
  aac: [0xff, 0xf1],
  mp3: [0x49, 0x44, 0x33], // ID3
  txt: [],
  csv: [],
}

describe('amostras de mídia', () => {
  it('cobre um formato de cada espécie que a Meta aceita', () => {
    const kinds = new Set(MEDIA_SAMPLES.map((sample) => sample.mediaType))
    expect(kinds).toEqual(new Set(['image', 'video', 'audio', 'document', 'sticker']))
  })

  it('não repete nome', () => {
    const names = MEDIA_SAMPLES.map((sample) => sample.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it.each(MEDIA_SAMPLES.map((sample) => [sample.name, sample] as const))(
    '%s tem bytes do próprio formato e tamanho declarado',
    (name, sample) => {
      const bytes = readMediaSample(name)

      expect(bytes.length).toBe(sample.sizeBytes)
      expect(bytes.length).toBeGreaterThan(0)
      expect([...bytes.subarray(0, MAGIC_BYTES[name].length)]).toEqual([...MAGIC_BYTES[name]])
    },
  )

  it('devolve buffer novo a cada leitura, para que escrever num não afete o próximo', () => {
    const first = readMediaSample('pdf')
    first.fill(0)

    expect(readMediaSample('pdf').subarray(0, 4).toString()).toBe('%PDF')
  })

  it('acha a amostra pelo nome e falha alto quando o nome não existe', () => {
    expect(findMediaSample('ogg').mimeType).toBe('audio/ogg; codecs=opus')
    expect(() => findMediaSample('flac' as MediaSampleName)).toThrow('Amostra de mídia desconhecida')
  })
})
