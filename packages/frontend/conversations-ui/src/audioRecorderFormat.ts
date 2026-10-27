/**
 * Cinco minutos: com o codec de voz do WhatsApp isso dá menos de 3MB, folgado dentro do teto de
 * 16MB que a Meta impõe a áudio, e é mais do que qualquer recado de cliente. O corte automático
 * existe porque gravação esquecida aberta só se descobre no envio, com o arquivo inteiro perdido.
 */
export const DEFAULT_MAX_RECORDING_MILLISECONDS = 5 * 60 * 1000

/**
 * Ordem de preferência de formato: os dois primeiros o WhatsApp aceita como áudio; `webm` é só
 * saída de emergência para navegador que não grava mais nada — gravar em webm e descobrir na hora
 * do envio que o formato é inválido é pior do que gravar já no formato certo.
 */
export const RECORDING_FORMATS = [
  { mimeType: 'audio/ogg;codecs=opus', uploadMimeType: 'audio/ogg', extension: 'ogg' },
  { mimeType: 'audio/mp4', uploadMimeType: 'audio/mp4', extension: 'm4a' },
  { mimeType: 'audio/webm', uploadMimeType: 'audio/webm', extension: 'webm' },
] as const

export type RecordingFormat = (typeof RECORDING_FORMATS)[number]

/** Primeiro formato que o navegador sabe gravar, ou `undefined` se não souber gravar nenhum. */
export function resolveRecordingFormat(): RecordingFormat | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  // `isTypeSupported` não existe em toda implementação; onde falta, o primeiro da lista é o palpite.
  if (typeof MediaRecorder.isTypeSupported !== 'function') return RECORDING_FORMATS[0]
  return RECORDING_FORMATS.find((format) => MediaRecorder.isTypeSupported(format.mimeType))
}
