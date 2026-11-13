export const AUDIO_CONTAINER = {
  OGG: 'ogg',
  MPEG: 'mpeg',
  AAC_ADTS: 'aac-adts',
  AMR: 'amr',
  MP4_AUDIO: 'mp4-audio',
  MP4_GENERIC: 'mp4-generic',
  MATROSKA: 'matroska',
  UNKNOWN: 'unknown',
} as const

export type AudioContainer = (typeof AUDIO_CONTAINER)[keyof typeof AUDIO_CONTAINER]

// Brands de MP4 que a Meta reconhece como áudio. Um arquivo `isom` é MP4 válido e toca em
// qualquer player, mas o processamento da Meta o classifica como application/octet-stream e
// recusa o envio com o erro 131053 — e é isso que o MediaRecorder do Chrome produz ao gravar
// `audio/mp4`.
const AUDIO_MP4_BRANDS = ['M4A ', 'M4B ', 'mp42', 'mp41']

function readAscii(buffer: Buffer, start: number, length: number): string {
  return buffer.subarray(start, start + length).toString('latin1')
}

/**
 * O container real dos bytes. O mimeType declarado pelo navegador não serve para decidir: ele
 * descreve a intenção do gravador, não o que saiu dele.
 */
export function detectAudioContainer(buffer: Buffer): AudioContainer {
  if (buffer.byteLength < 12) return AUDIO_CONTAINER.UNKNOWN

  if (readAscii(buffer, 0, 4) === 'OggS') return AUDIO_CONTAINER.OGG
  if (readAscii(buffer, 0, 5) === '#!AMR') return AUDIO_CONTAINER.AMR
  if (readAscii(buffer, 0, 3) === 'ID3') return AUDIO_CONTAINER.MPEG

  if (readAscii(buffer, 4, 4) === 'ftyp') {
    return AUDIO_MP4_BRANDS.includes(readAscii(buffer, 8, 4)) ? AUDIO_CONTAINER.MP4_AUDIO : AUDIO_CONTAINER.MP4_GENERIC
  }

  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return AUDIO_CONTAINER.MATROSKA
  }

  if (buffer[0] === 0xff) {
    const second = buffer[1] ?? 0
    if (second === 0xf1 || second === 0xf9) return AUDIO_CONTAINER.AAC_ADTS
    if ((second & 0xe0) === 0xe0) return AUDIO_CONTAINER.MPEG
  }

  return AUDIO_CONTAINER.UNKNOWN
}

const CONTAINERS_ACCEPTED_BY_WHATSAPP: readonly AudioContainer[] = [
  AUDIO_CONTAINER.OGG,
  AUDIO_CONTAINER.MPEG,
  AUDIO_CONTAINER.AAC_ADTS,
  AUDIO_CONTAINER.AMR,
  AUDIO_CONTAINER.MP4_AUDIO,
]

export function isAcceptedByWhatsApp(container: AudioContainer): boolean {
  return CONTAINERS_ACCEPTED_BY_WHATSAPP.includes(container)
}
