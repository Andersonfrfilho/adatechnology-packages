/**
 * Gravação de áudio no simulador, pelo microfone do próprio navegador.
 *
 * Existe porque áudio é o formato que mais chega de cliente real e o que mais quebra fluxo: sem
 * poder gravar aqui, testar o caminho de transcrição exigia mandar mensagem do celular de alguém.
 *
 * O arquivo gravado sai daqui como `File` e segue exatamente o mesmo caminho de um anexo — quem
 * hospeda e devolve o `mediaId` é o host, via `uploadMedia`.
 */

import { useCallback, useRef, useState } from 'react'

export interface AudioRecorderButtonLabels {
  start: string
  stop: string
  unsupported: string
  denied: string
}

export const DEFAULT_AUDIO_RECORDER_BUTTON_LABELS: AudioRecorderButtonLabels = {
  start: 'Gravar áudio',
  stop: 'Parar gravação',
  unsupported: 'Este navegador não grava áudio.',
  denied: 'Sem permissão para usar o microfone.',
}

export interface AudioRecorderButtonProps {
  onRecorded: (file: File) => void | Promise<void>
  onFailure?: (message: string) => void
  labels?: Partial<AudioRecorderButtonLabels>
  disabled?: boolean
}

/**
 * Ordem de preferência de formato: os dois primeiros o WhatsApp aceita como áudio; `webm` é só
 * saída de emergência para navegador que não grava mais nada — gravar em webm e descobrir na hora
 * do envio que o formato é inválido é pior do que gravar já no formato certo.
 */
const RECORDING_FORMATS = [
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

export function AudioRecorderButton({ onRecorded, onFailure, labels, disabled }: AudioRecorderButtonProps) {
  const startLabel = labels?.start ?? DEFAULT_AUDIO_RECORDER_BUTTON_LABELS.start
  const stopLabel = labels?.stop ?? DEFAULT_AUDIO_RECORDER_BUTTON_LABELS.stop
  const [isRecording, setIsRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)

  const stop = useCallback(() => {
    recorderRef.current?.stop()
  }, [])

  const start = useCallback(async () => {
    const format = resolveRecordingFormat()
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      onFailure?.(labels?.unsupported ?? DEFAULT_AUDIO_RECORDER_BUTTON_LABELS.unsupported)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: format.mimeType })
      const chunks: Blob[] = []

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      })
      recorder.addEventListener('stop', () => {
        // Solta o microfone assim que para: sem isto o indicador de gravação do navegador fica
        // aceso depois do envio, e o operador acha que o simulador continua ouvindo.
        stream.getTracks().forEach((track) => track.stop())
        setIsRecording(false)
        recorderRef.current = null
        // O `File` sai com o MIME sem os parâmetros de codec: `audio/ogg;codecs=opus` serve ao
        // gravador, mas quem valida upload compara com `audio/ogg` puro.
        const blob = new Blob(chunks, { type: format.uploadMimeType })
        void onRecorded(
          new File([blob], `audio-${Date.now()}.${format.extension}`, { type: format.uploadMimeType }),
        )
      })

      recorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch {
      onFailure?.(labels?.denied ?? DEFAULT_AUDIO_RECORDER_BUTTON_LABELS.denied)
    }
  }, [labels?.denied, labels?.unsupported, onFailure, onRecorded])

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => (isRecording ? stop() : void start())}
      title={isRecording ? stopLabel : startLabel}
      aria-label={isRecording ? stopLabel : startLabel}
      aria-pressed={isRecording}
      /* Mesma caixa do botão de enviar: o microfone ocupa o lugar dele enquanto o campo está
         vazio, e qualquer diferença de tamanho faz a barra pular a cada letra digitada. */
      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
        isRecording
          ? 'bg-red-500 text-white hover:bg-red-600'
          : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {isRecording ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 11a7 7 0 0 1-14 0" /><line x1="12" y1="18" x2="12" y2="22" /></svg>
      )}
    </button>
  )
}
