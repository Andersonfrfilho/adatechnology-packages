/**
 * Guarda que o preview entrega arquivo do tipo que promete.
 *
 * O defeito que motivou o arquivo: `getDocumentUrl` devolvia sempre a mesma imagem PNG, então
 * "visualizar" num PDF abria um PNG rotulado `application/pdf` e o leitor dizia que o arquivo era
 * inválido. Aqui os bytes são decodificados e conferidos pela assinatura de cada formato — teste que
 * só olhasse o prefixo da data URL passaria com o bug de volta.
 */

import { describe, expect, it } from 'bun:test'

import { PREVIEW_FILE_SAMPLES, resolvePreviewFileSample } from './previewFileSamples'
import { PREVIEW_DOCUMENTS } from './previewFixtures'

function decode(dataUrl: string): { mimeType: string; bytes: Uint8Array } {
  const [head, payload] = dataUrl.split(',')
  const mimeType = head!.replace(/^data:/, '').replace(/;base64$/, '')
  if (!head!.endsWith(';base64')) {
    return { mimeType, bytes: new TextEncoder().encode(decodeURIComponent(payload!)) }
  }
  return { mimeType, bytes: Uint8Array.from(atob(payload!), (char) => char.charCodeAt(0)) }
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte)
}

const ascii = (text: string): number[] => [...text].map((char) => char.charCodeAt(0))

// Assinatura real de cada formato, não o rótulo do mimeType.
const SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  'application/pdf': (bytes) => startsWith(bytes, ascii('%PDF-')),
  'image/png': (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]),
  'image/jpeg': (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  'image/webp': (bytes) => startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8),
  'video/mp4': (bytes) => startsWith(bytes, ascii('ftyp'), 4),
  'audio/mp4': (bytes) => startsWith(bytes, ascii('ftyp'), 4),
  // ID3 quando há tag, ou o sync do primeiro frame MPEG.
  'audio/mpeg': (bytes) => startsWith(bytes, ascii('ID3')) || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0),
  'audio/ogg': (bytes) => startsWith(bytes, ascii('OggS')),
  'audio/aac': (bytes) => bytes[0] === 0xff && (bytes[1]! & 0xf0) === 0xf0,
  'text/plain': (bytes) => bytes.length > 0,
  'text/csv': (bytes) => bytes.length > 0,
  // Todo pacote Office é zip: assinatura PK\x03\x04.
  'application/zip': (bytes) => startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (bytes) =>
    startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': (bytes) =>
    startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]),
}

describe('amostras de arquivo do preview', () => {
  it('toda amostra declara o mimeType que anuncia', () => {
    for (const [mimeType, dataUrl] of Object.entries(PREVIEW_FILE_SAMPLES)) {
      expect(decode(dataUrl).mimeType).toBe(mimeType)
    }
  })

  for (const [mimeType, isValid] of Object.entries(SIGNATURES)) {
    it(`os bytes de ${mimeType} são realmente desse formato`, () => {
      const sample = PREVIEW_FILE_SAMPLES[mimeType]
      expect(sample).toBeDefined()
      expect(isValid(decode(sample!).bytes)).toBe(true)
    })
  }

  // O PDF sem xref/startxref é o caso que alguns leitores recusam de cara.
  it('o PDF tem tabela xref e termina em %%EOF', () => {
    const text = new TextDecoder().decode(decode(PREVIEW_FILE_SAMPLES['application/pdf']!).bytes)

    expect(text).toContain('\nxref\n')
    expect(text).toContain('startxref')
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
  })
})

describe('resolvePreviewFileSample', () => {
  it('descarta parâmetro do mimeType — áudio de WhatsApp chega com codecs', () => {
    expect(resolvePreviewFileSample('audio/ogg; codecs=opus')).toBe(PREVIEW_FILE_SAMPLES['audio/ogg'])
  })

  // Tipos aceitos pela Meta sem amostra local (sem encoder amr/3gp nesta máquina): tocam pela
  // família, em vez de devolver bytes de outro formato.
  it('cai na família quando não há amostra do tipo exato', () => {
    expect(resolvePreviewFileSample('audio/amr')).toBe(PREVIEW_FILE_SAMPLES['audio/mpeg'])
    expect(resolvePreviewFileSample('video/3gp')).toBe(PREVIEW_FILE_SAMPLES['video/mp4'])
    expect(resolvePreviewFileSample('image/heic')).toBe(PREVIEW_FILE_SAMPLES['image/png'])
  })

  // Office legado é OLE2, não zip: servir o docx aqui daria arquivo corrompido no Word. Melhor um
  // texto que abre e se explica.
  it('explica em texto quando não há como forjar o binário', () => {
    const resolved = resolvePreviewFileSample('application/msword', 'procuracao.doc')

    expect(resolved.startsWith('data:text/plain')).toBe(true)
    expect(decodeURIComponent(resolved)).toContain('procuracao.doc')
  })

  it('não devolve vazio para tipo desconhecido', () => {
    expect(resolvePreviewFileSample(undefined).length).toBeGreaterThan(0)
    expect(resolvePreviewFileSample('application/octet-stream').length).toBeGreaterThan(0)
  })
})

describe('biblioteca do preview', () => {
  // A infidelidade que existia: a biblioteca listava só `document`, enquanto o backend linka as
  // cinco espécies de mídia. Foto, vídeo, áudio e sticker apareciam na tela real e não no preview.
  it('lista foto, vídeo, áudio e sticker junto dos documentos', () => {
    const mimeTypes = (PREVIEW_DOCUMENTS['5511944443333'] ?? []).map((document) => document.mimeType)

    expect(mimeTypes.some((mimeType) => mimeType.startsWith('image/'))).toBe(true)
    expect(mimeTypes.some((mimeType) => mimeType.startsWith('video/'))).toBe(true)
    expect(mimeTypes.some((mimeType) => mimeType.startsWith('audio/'))).toBe(true)
    expect(mimeTypes).toContain('image/webp')
  })

  // Cada tipo que a Cloud API da Meta aceita para envio de mídia.
  const ACCEPTED_BY_META = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/3gp',
    'audio/aac',
    'audio/amr',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
  ]

  it('cobre todo tipo aceito pela Meta', () => {
    const present = new Set((PREVIEW_DOCUMENTS['5511944443333'] ?? []).map((document) => document.mimeType))
    const faltando = ACCEPTED_BY_META.filter((mimeType) => !present.has(mimeType))

    expect(faltando).toEqual([])
  })

  it('todo item da biblioteca abre com bytes não vazios', () => {
    for (const document of PREVIEW_DOCUMENTS['5511944443333'] ?? []) {
      expect(decode(resolvePreviewFileSample(document.mimeType, document.filename)).bytes.length).toBeGreaterThan(0)
    }
  })
})
