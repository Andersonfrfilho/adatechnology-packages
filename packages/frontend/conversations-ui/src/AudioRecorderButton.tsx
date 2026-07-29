/**
 * Gravação de áudio no simulador, pelo microfone do próprio navegador.
 *
 * Existe porque áudio é o formato que mais chega de cliente real e o que mais quebra fluxo: sem
 * poder gravar aqui, testar o caminho de transcrição exigia mandar mensagem do celular de alguém.
 *
 * O arquivo gravado sai daqui como `File` e segue exatamente o mesmo caminho de um anexo — quem
 * hospeda e devolve o `mediaId` é o host, via `uploadMedia`.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { AudioPlayer } from './AudioPlayer'

export interface AudioRecorderButtonLabels {
  start: string
  stop: string
  unsupported: string
  denied: string
  review: string
  send: string
  discard: string
  empty: string
}

export const DEFAULT_AUDIO_RECORDER_BUTTON_LABELS: AudioRecorderButtonLabels = {
  start: 'Gravar áudio',
  stop: 'Parar gravação',
  unsupported: 'Este navegador não grava áudio.',
  denied: 'Sem permissão para usar o microfone.',
  review: 'Ouça antes de enviar',
  send: 'Enviar áudio',
  discard: 'Descartar áudio',
  empty: 'Nada foi captado pelo microfone.',
}

export interface AudioRecorderButtonProps {
  onRecorded: (file: File) => void | Promise<void>
  onFailure?: (message: string) => void
  /**
   * Avisa quando a gravação começa e termina. O botão é um interruptor — o segundo toque é que
   * envia — e sem um aviso fora dele o operador grava, não vê nada acontecer e desiste achando
   * que o microfone está quebrado.
   */
  onRecordingChange?: (isRecording: boolean) => void
  /**
   * Abre uma etapa de revisão quando a gravação para: o áudio toca ali mesmo e só sai depois de
   * confirmado. Ligado por padrão — voz é o único anexo que quem envia não viu antes de mandar, e
   * sem ouvir não há como saber se o microfone captou alguma coisa. Desligar volta ao envio direto.
   */
  reviewBeforeSend?: boolean
  /**
   * Teto de duração da gravação, em milissegundos. Passado o tempo, o gravador para e envia o que
   * tem. Produto com limite próprio sobrescreve.
   */
  maxDurationMilliseconds?: number
  labels?: Partial<AudioRecorderButtonLabels>
  disabled?: boolean
}

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

type PendingRecording = { file: File; objectURL: string }

export function AudioRecorderButton({
  onRecorded,
  onFailure,
  onRecordingChange,
  reviewBeforeSend = true,
  maxDurationMilliseconds = DEFAULT_MAX_RECORDING_MILLISECONDS,
  labels,
  disabled,
}: AudioRecorderButtonProps) {
  const labelOf = (key: keyof AudioRecorderButtonLabels): string =>
    labels?.[key] ?? DEFAULT_AUDIO_RECORDER_BUTTON_LABELS[key]
  const [isRecording, setIsRecording] = useState(false)
  const [pending, setPending] = useState<PendingRecording | undefined>(undefined)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // O `objectURL` é um recurso do documento, não do React: sem revogar, cada gravação descartada
  // deixa o blob inteiro preso na memória da aba até um reload.
  const discard = useCallback(() => {
    setPending((current) => {
      if (current) URL.revokeObjectURL(current.objectURL)
      return undefined
    })
  }, [])

  useEffect(() => discard, [discard])

  const confirm = useCallback(() => {
    if (!pending) return
    void onRecorded(pending.file)
    discard()
  }, [discard, onRecorded, pending])

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
        clearTimeout(autoStopRef.current)
        setIsRecording(false)
        onRecordingChange?.(false)
        recorderRef.current = null
        // O `File` sai com o MIME sem os parâmetros de codec: `audio/ogg;codecs=opus` serve ao
        // gravador, mas quem valida upload compara com `audio/ogg` puro.
        const blob = new Blob(chunks, { type: format.uploadMimeType })
        const file = new File([blob], `audio-${Date.now()}.${format.extension}`, {
          type: format.uploadMimeType,
        })

        // Gravação vazia não vira anexo: microfone mudo ou permissão revogada no meio produzem um
        // blob de zero byte, e mandá-lo adiante só falha lá na frente, sem dizer por quê.
        if (blob.size === 0) {
          onFailure?.(labelOf('empty'))
          return
        }

        if (!reviewBeforeSend) {
          void onRecorded(file)
          return
        }

        setPending({ file, objectURL: URL.createObjectURL(blob) })
      })

      recorderRef.current = recorder
      recorder.start()
      autoStopRef.current = setTimeout(() => recorder.stop(), maxDurationMilliseconds)
      setIsRecording(true)
      onRecordingChange?.(true)
    } catch {
      onFailure?.(labels?.denied ?? DEFAULT_AUDIO_RECORDER_BUTTON_LABELS.denied)
    }
    // `labelOf` lê `labels` a cada render e não entra aqui; o que importa para recriar o gravador
    // são o teto de duração, o destino da gravação e se há etapa de revisão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDurationMilliseconds, onFailure, onRecorded, onRecordingChange, reviewBeforeSend])

  const toggleLabel = isRecording ? labelOf('stop') : labelOf('start')

  return (
    /* O painel de revisão flutua sobre o botão em vez de ocupar espaço na barra: o microfone mora
       na caixa do botão de enviar, e empurrar o composer para cima a cada gravação faria a
       conversa saltar. */
    <div className="relative flex-shrink-0">
      {pending && (
        <div
          role="group"
          aria-label={labelOf('review')}
          /* Largura presa à viewport, não ao conteúdo: ancorado à direita do microfone, qualquer
             largura fixa maior que a tela sangra para fora no celular. `flex-wrap` é a segunda
             rede — se o player e os dois botões não couberem lado a lado, os botões descem. */
          className="absolute bottom-full right-0 z-20 mb-2 flex w-[calc(100vw-2rem)] max-w-[20rem] flex-wrap items-center justify-end gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="min-w-0 flex-1">
            <AudioPlayer src={pending.objectURL} />
          </div>
          <button
            type="button"
            onClick={discard}
            title={labelOf('discard')}
            aria-label={labelOf('discard')}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-700"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          <button
            type="button"
            onClick={confirm}
            title={labelOf('send')}
            aria-label={labelOf('send')}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white transition-colors hover:bg-emerald-600"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
          </button>
        </div>
      )}
      <button
        type="button"
        disabled={disabled || pending !== undefined}
        onClick={() => (isRecording ? stop() : void start())}
        title={toggleLabel}
        aria-label={toggleLabel}
        aria-pressed={isRecording}
        /* Mesma caixa do botão de enviar: o microfone ocupa o lugar dele enquanto o campo está
           vazio, e qualquer diferença de tamanho faz a barra pular a cada letra digitada. */
        className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
          isRecording
            ? 'animate-pulse bg-red-500 text-white ring-4 ring-red-500/30 hover:bg-red-600'
            : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        {isRecording ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 11a7 7 0 0 1-14 0" /><line x1="12" y1="18" x2="12" y2="22" /></svg>
        )}
      </button>
    </div>
  )
}
