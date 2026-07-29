import { useState, type ReactNode } from 'react'
import { AudioPlayer } from './AudioPlayer'
import { FileIcon } from './FileIcon'
import { useConversationLocales } from './ConversationLocalesProvider'
import { formatFileSize } from './lib/format'
import { cn } from './lib/cn'
import type { MessagePayload } from './types'

/**
 * Rótulo curto do tipo, para a linha de baixo da bolha de documento.
 *
 * O subtipo cru do Office é gigantesco — `vnd.openxmlformats-officedocument.wordprocessingml.document`
 * vira uma linha de 58 caracteres em caixa alta que estica a bolha, empurra a coluna da conversa e
 * quebra o layout de três painéis. A extensão do arquivo diz a mesma coisa em quatro letras.
 */
export function documentTypeLabel(filename?: string, mimeType?: string): string {
  const extension = filename?.split('.').pop()
  if (extension && extension.length <= 5 && extension !== filename) return extension.toUpperCase()

  const subtype = mimeType?.split(';')[0]?.split('/')[1]
  if (!subtype) return 'FILE'
  // Sem extensão e com subtipo longo (áudio/vídeo sem nome), fica o sufixo depois do último ponto:
  // `…wordprocessingml.document` -> `DOCUMENT`, que ainda informa e não estoura.
  const compacto = subtype.split('.').pop() ?? subtype
  return compacto.slice(0, 12).toUpperCase()
}

function resolveMediaSource(message: MessagePayload): string | null {
  if (message.mediaUrl) return message.mediaUrl
  if (message.base64) {
    const prefix = message.mimeType
      ? `data:${message.mimeType};base64,`
      : 'data:application/octet-stream;base64,'
    return prefix + message.base64
  }
  return null
}

function hasLazyRef(message: MessagePayload): boolean {
  return Boolean(message.uploadId || message.mediaId)
}

export type ResolveMediaUrl = (message: MessagePayload) => Promise<string | null>

export interface MediaRendererProps {
  message: MessagePayload
  onLightbox: (src: string) => void
  // Porta injetada pelo host para resolver `uploadId`/`mediaId` numa URL assinada sob
  // demanda (lazy) — o pacote nunca chama um endpoint fixo. Paridade com o padrão
  // loadUrl/loadMedia de financiamento-imobiliario-bot/apps/web/src/components/MessageBubble.tsx,
  // porém delegando o fetch ao host em vez de hardcodar `/uploads/:id/download-url`.
  onResolveUrl?: ResolveMediaUrl
  /** Aplicado no wrapper de cada tipo de mídia — imagem, vídeo, áudio e documento. */
  className?: string
}

function useLazyMediaUrl(message: MessagePayload, onResolveUrl?: ResolveMediaUrl) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const load = async () => {
    if (url || loading || !onResolveUrl) return
    setLoading(true)
    setError(false)
    try {
      const resolved = await onResolveUrl(message)
      if (resolved) setUrl(resolved)
      else setError(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return { url, loading, error, load }
}

export function MediaRenderer({ message, onLightbox, onResolveUrl, className }: MediaRendererProps) {
  const { bubble } = useConversationLocales()
  const eagerSrc = resolveMediaSource(message)
  const lazy = useLazyMediaUrl(message, onResolveUrl)
  const src = eagerSrc ?? lazy.url
  const canLazyLoad = !eagerSrc && hasLazyRef(message) && Boolean(onResolveUrl)

  /**
   * O carregamento sob demanda continua sendo um botão, mas com a forma da mídia que ele vai virar
   * — um link sublinhado no meio da conversa lê como texto da mensagem, não como controle, e é a
   * única bolha que não se parece com o que contém.
   */
  function LazyMediaButton({ icon, label }: { icon: ReactNode; label: string }) {
    return (
      <button
        onClick={lazy.load}
        disabled={lazy.loading}
        className="flex min-w-[180px] items-center gap-2 rounded-lg bg-black/5 px-2 py-1.5 text-left transition-colors hover:bg-black/10 disabled:opacity-60 dark:bg-white/10 dark:hover:bg-white/15"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-600 text-white">
          {icon}
        </span>
        <span className="truncate text-xs text-gray-600 dark:text-gray-300">{label}</span>
      </button>
    )
  }

  switch (message.type) {
    case 'image':
    case 'sticker': {
      if (!src && canLazyLoad) {
        return (
          <LazyMediaButton
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>}
            label={lazy.loading ? bubble.mediaLoading : lazy.error ? bubble.mediaRetry : bubble.viewImage}
          />
        )
      }
      return (
        <div className="min-w-[200px]">
          {src ? (
            <img src={src} alt={message.caption ?? bubble.imageAlt} className="w-full max-h-80 object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => onLightbox(src)} loading="lazy" />
          ) : (
            <div className="w-full h-40 bg-gray-200 flex items-center justify-center text-gray-400">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            </div>
          )}
        </div>
      )
    }
    case 'video': {
      if (!src && canLazyLoad) {
        return (
          <LazyMediaButton
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>}
            label={lazy.loading ? bubble.mediaLoading : lazy.error ? bubble.mediaRetry : bubble.viewVideo}
          />
        )
      }
      return (
        <div className="min-w-[200px]">
          {src ? (
            <video src={src} className="w-full max-h-80 rounded-lg" controls preload="metadata"><track kind="captions" /></video>
          ) : (
            <div className="w-full h-32 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
            </div>
          )}
        </div>
      )
    }
    case 'audio': {
      if (!src && canLazyLoad) {
        return (
          <LazyMediaButton
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="translate-x-0.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>}
            label={lazy.loading ? bubble.mediaLoading : lazy.error ? bubble.mediaRetry : bubble.listenAudio}
          />
        )
      }
      return (
        <div className="min-w-[200px]">
          {src ? <AudioPlayer src={src} isMine={message.direction === 'outbound'} /> : (
            <div className="h-12 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">{bubble.mediaUnavailable}</div>
          )}
        </div>
      )
    }
    case 'document': {
      const typeLabel = documentTypeLabel(message.filename, message.mimeType)
      const sizeLabel = message.sizeBytes ? formatFileSize(message.sizeBytes) : null
      return (
        <div className={cn('flex items-center gap-3 min-w-[200px]', className)}>
          <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileIcon filename={message.filename} mimeType={message.mimeType} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{message.filename ?? bubble.untitledDocument}</p>
            <p className="truncate text-xs text-gray-500">{sizeLabel ? `${typeLabel} · ${sizeLabel}` : typeLabel}</p>
          </div>
          {src ? (
            <a href={src} download={message.filename} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 flex-shrink-0 transition-colors" aria-label={bubble.downloadFile}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            </a>
          ) : canLazyLoad ? (
            <button
              onClick={lazy.load}
              disabled={lazy.loading}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 flex-shrink-0 transition-colors disabled:opacity-50"
              aria-label={bubble.downloadFile}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            </button>
          ) : null}
          {lazy.error && <span className="text-xs text-red-500 flex-shrink-0">{bubble.mediaError}</span>}
        </div>
      )
    }
    default:
      return null
  }
}
