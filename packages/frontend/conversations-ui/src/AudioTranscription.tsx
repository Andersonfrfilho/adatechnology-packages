import { useCallback, useState } from 'react'
import { Check, Copy, FileText, Loader2, RefreshCw } from 'lucide-react'
import { useConversationLocales } from './ConversationLocalesProvider'
import { cn } from './lib/cn'
import type { MessageTranscription } from './types'

export interface AudioTranscriptionProps {
  transcription?: MessageTranscription | null
  /**
   * Pede a transcrição ao backend. Ausente, o bloco nunca oferece o botão — um host em modo
   * automático não tem rota para isso, e desenhar um botão que estoura no clique é pior do que não
   * desenhar nada.
   *
   * O que for devolvido é exibido na hora. Sem isso o texto só apareceria no próximo refetch da
   * lista, e transcrição não emite evento de tempo real: o operador clicaria, veria o spinner
   * terminar e continuaria sem o texto na tela.
   */
  onTranscribe?: () => Promise<MessageTranscription | void>
  isMine?: boolean
}

/** Feedback de "copiado" some sozinho — confirmação que exige clique para fechar é ruído. */
const COPIED_FEEDBACK_MS = 2000

/**
 * Acima disto a transcrição nasce recolhida.
 *
 * Medido: 1147 caracteres (cerca de um minuto de fala) produziram uma bolha de 854px — mais alta que
 * a área visível da conversa, empurrando todo o resto para fora. Nota de voz de três minutos
 * triplicaria. O limite é em caracteres, e não em linhas de CSS, porque a decisão precisa acontecer
 * antes de renderizar: `line-clamp` sozinho esconde o texto mas ainda paga o layout inteiro.
 */
const COLLAPSE_ABOVE_CHARS = 320

/** Linhas visíveis quando recolhido — o bastante para saber do que o cliente está falando. */
const COLLAPSED_LINE_CLAMP = 4

/**
 * Transcrição sob a nota de voz, com botão de copiar.
 *
 * Copiar é o motivo de o bloco existir: o operador cola o pedido do cliente no sistema interno, no
 * orçamento, na busca. Seleção manual de texto dentro de um balão de chat é exatamente onde o
 * arrasto do mouse falha — pega o balão vizinho, o horário, o nome do remetente.
 *
 * `navigator.clipboard.writeText` com try/catch silencioso, mesmo padrão de `MessageText.tsx`: a API
 * exige contexto seguro e permissão, e um host servindo em HTTP simples não a tem. Falhar sem alarme
 * é o certo — o texto continua na tela para seleção manual.
 */
export function AudioTranscription({ transcription, onTranscribe, isMine = false }: AudioTranscriptionProps) {
  const { transcription: locales } = useConversationLocales()
  const [hasCopied, setHasCopied] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [hasRequestFailed, setHasRequestFailed] = useState(false)
  /**
   * Resultado que acabou de voltar do backend, exibido antes de a lista ser refeita.
   *
   * Tem precedência sobre a prop porque é o dado mais novo: o refetch, quando vier, traz a mesma
   * coisa. Sem isto o clique terminaria em nada visível.
   */
  const [justTranscribed, setJustTranscribed] = useState<MessageTranscription | undefined>()
  const [isExpanded, setIsExpanded] = useState(false)

  const effective = justTranscribed ?? transcription
  const text = effective?.text?.trim() ?? ''
  const status = effective?.status

  // Nasce recolhido e o operador decide: abrir tudo por padrão faria a nota de voz longa esconder as
  // mensagens seguintes, que é justamente o contexto de que ele precisa para responder.
  const isLong = text.length > COLLAPSE_ABOVE_CHARS
  const isTruncated = isLong && !isExpanded
  const isDone = status === 'done'
  const hasText = isDone && text.length > 0
  // Silêncio já processado: dizer "sem fala detectada" evita o operador clicar em transcrever de novo
  // atrás de um texto que não existe.
  const isSilent = isDone && text.length === 0

  const handleCopy = useCallback(async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setHasCopied(true)
      setTimeout(() => setHasCopied(false), COPIED_FEEDBACK_MS)
    } catch {
      // Clipboard indisponível (contexto não seguro, permissão negada) — o texto segue selecionável.
    }
  }, [text])

  const handleTranscribe = useCallback(async () => {
    if (!onTranscribe || isTranscribing) return
    setIsTranscribing(true)
    setHasRequestFailed(false)
    try {
      const result = await onTranscribe()
      if (result) setJustTranscribed(result)
    } catch {
      setHasRequestFailed(true)
    } finally {
      setIsTranscribing(false)
    }
  }, [onTranscribe, isTranscribing])

  const dividerClass = isMine ? 'border-black/10 dark:border-white/10' : 'border-black/10 dark:border-white/10'

  // Nada avaliado e sem rota para pedir: o balão fica como era antes da transcrição existir.
  if (!status && !onTranscribe) return null

  if (!status || status === 'pending' || status === 'failed') {
    return (
      <div className={`mt-1.5 border-t pt-1.5 ${dividerClass}`}>
        <TranscribeButton
          label={resolveActionLabel({ status, hasRequestFailed, isTranscribing, locales })}
          isBusy={isTranscribing}
          onClick={handleTranscribe}
          isDisabled={!onTranscribe}
        />
      </div>
    )
  }

  if (status === 'unsupported') {
    return (
      <div className={`mt-1.5 border-t pt-1.5 ${dividerClass}`}>
        <p className="text-xs italic text-gray-500 dark:text-gray-400">{locales.unsupported}</p>
      </div>
    )
  }

  return (
    <div className={`mt-1.5 border-t pt-1.5 ${dividerClass}`}>
      <div className="mb-0.5 flex items-center gap-1.5">
        <FileText size={11} className="flex-shrink-0 text-gray-500 dark:text-gray-400" aria-hidden />
        <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {locales.label}
        </span>

        {hasText && (
          <button
            onClick={handleCopy}
            title={locales.copy}
            aria-label={hasCopied ? locales.copied : locales.copy}
            className="ml-auto flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
          >
            {hasCopied ? (
              <>
                <Check size={11} aria-hidden />
                <span>{locales.copied}</span>
              </>
            ) : (
              <>
                <Copy size={11} aria-hidden />
                <span>{locales.copy}</span>
              </>
            )}
          </button>
        )}
      </div>

      {isSilent ? (
        <p className="text-xs italic text-gray-500 dark:text-gray-400">{locales.empty}</p>
      ) : (
        <>
          {/* `select-all` para o clique único selecionar tudo: é o fallback quando o clipboard não
              está disponível, e o caminho de quem prefere copiar com o teclado. */}
          <p
            className={cn(
              'select-all whitespace-pre-wrap break-words text-[13px] leading-[18px] text-gray-700 dark:text-gray-200',
              isTruncated && 'overflow-hidden',
            )}
            style={
              isTruncated
                ? {
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: COLLAPSED_LINE_CLAMP,
                  }
                : undefined
            }
          >
            {text}
          </p>
          {/* O botão de copiar leva o texto INTEIRO, recolhido ou não — recolher é sobre altura na
              tela, não sobre o que o operador cola no sistema interno. */}
          {isLong && (
            <button
              onClick={() => setIsExpanded((current) => !current)}
              className="mt-1 text-[11px] font-medium text-gray-500 underline decoration-dotted hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {isExpanded ? locales.showLess : locales.showMore}
            </button>
          )}
        </>
      )}

      {/* Retranscrever fica escondido atrás do hover do balão: é ação rara e paga cota de engine. */}
      {onTranscribe && (
        <button
          onClick={handleTranscribe}
          disabled={isTranscribing}
          className="mt-1 flex items-center gap-1 text-[11px] text-gray-400 opacity-0 transition-opacity hover:text-gray-600 focus:opacity-100 group-hover:opacity-100 disabled:opacity-50 dark:text-gray-500 dark:hover:text-gray-300"
        >
          {isTranscribing ? <Loader2 size={10} className="animate-spin" aria-hidden /> : <RefreshCw size={10} aria-hidden />}
          <span>{isTranscribing ? locales.transcribing : locales.retry}</span>
        </button>
      )}
    </div>
  )
}

function resolveActionLabel(params: {
  status?: MessageTranscription['status']
  hasRequestFailed: boolean
  isTranscribing: boolean
  locales: { transcribe: string; transcribing: string; retry: string; failed: string }
}): string {
  if (params.isTranscribing) return params.locales.transcribing
  if (params.hasRequestFailed) return params.locales.retry
  // `pending` é cota estourada ou falha transitória do lado do servidor: já foi tentado e vai sair,
  // mas o operador que não quer esperar a retomada pode forçar agora.
  if (params.status === 'pending') return params.locales.transcribing
  if (params.status === 'failed') return params.locales.failed
  return params.locales.transcribe
}

function TranscribeButton({
  label,
  isBusy,
  isDisabled,
  onClick,
}: {
  label: string
  isBusy: boolean
  isDisabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={isBusy || isDisabled}
      className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700 disabled:opacity-60 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
    >
      {isBusy ? (
        <Loader2 size={11} className="animate-spin" aria-hidden />
      ) : (
        <FileText size={11} aria-hidden />
      )}
      <span>{label}</span>
    </button>
  )
}
