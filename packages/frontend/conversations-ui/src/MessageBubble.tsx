import { useState } from 'react'
import { Check } from 'lucide-react'
import type { MessagePayload } from './types'
import { useConversationLocales } from './ConversationLocalesProvider'
import { StatusTicks } from './StatusTicks'
import { MediaRenderer, type ResolveMediaUrl } from './MediaRenderer'
import { Lightbox } from './Lightbox'
import { parseWhatsAppFormatting } from './lib/whatsapp-formatting'
import { formatTimestamp, formatDateTime } from './lib/format'

export interface MessageBubbleProps {
  message: MessagePayload
  isMine: boolean
  senderName?: string | null
  isFirstInGroup?: boolean
  isSelecting?: boolean
  isSelected?: boolean
  onToggleSelect?: () => void
  onResolveMediaUrl?: ResolveMediaUrl
}

// Hex arbitrários (não os tokens `whatsapp.*` do Tailwind) — o pacote fica autocontido,
// sem exigir que o host replique a configuração de tema feita em tailwind.config.ts do bot.
const BUBBLE_COLOR: Record<string, string> = {
  agent: 'bg-[#d9fdd3] dark:bg-[#005c4b]',
  bot: 'bg-[#d7f0ec] dark:bg-[#0a3d3a]',
  customer: 'bg-white dark:bg-[#202c33]',
}

const MEDIA_TYPES = new Set(['image', 'audio', 'video', 'document', 'sticker'])

// Paridade com financiamento-imobiliario-bot/apps/web/src/components/MessageBubble.tsx —
// cor por sender, tail só no isFirstInGroup, agrupamento mt-2/mt-0.5, ring vermelho em
// falha, tick de status colorido, tooltip de readAt/janela expirada.
//
// Requer '@adatechnology/conversations-ui/styles.css' (ConversationWallpaper) ou um
// tailwind.config do host expondo as cores `whatsapp.*` — ver Wallpaper.tsx e T6.2.
export function MessageBubble({
  message, isMine, senderName, isFirstInGroup = true, isSelecting = false, isSelected = false, onToggleSelect,
  onResolveMediaUrl,
}: MessageBubbleProps) {
  const { bubble, selection } = useConversationLocales()
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const bubbleColor = BUBBLE_COLOR[message.sender] ?? BUBBLE_COLOR.customer
  const hasError = message.status === 'failed'
  const isMedia = MEDIA_TYPES.has(message.type)
  const isTemplate = message.type === 'template'
  const displayName = message.sender === 'agent' && senderName ? senderName : bubble[message.sender] ?? message.sender

  const tooltipText = message.status === 'read' && message.readAt
    ? `${bubble.readAt}${formatDateTime(message.readAt)}`
    : message.status === 'failed'
      ? bubble.windowExpired
      : undefined

  // Cantinho reto no topo (o "rabinho" do balão do WhatsApp) só na primeira mensagem de um grupo
  // consecutivo do mesmo remetente — o resto do grupo fica com os dois cantos superiores arredondados.
  const tailCornerClass = isFirstInGroup ? (isMine ? 'rounded-tr-md' : 'rounded-tl-md') : ''

  const checkbox = (
    <button
      onClick={(e) => { e.stopPropagation(); onToggleSelect?.() }}
      title={selection.select}
      className={`
        flex-shrink-0 self-end mb-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
        ${isSelected ? 'bg-teal-600 border-teal-600' : 'bg-white/80 dark:bg-black/40 border-black/20 dark:border-white/30'}
        ${isSelecting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
      `}
    >
      {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
    </button>
  )

  return (
    <div className={`flex items-end gap-1.5 ${isMine ? 'justify-end' : 'justify-start'} group ${isFirstInGroup ? 'mt-2' : 'mt-0.5'}`}>
      {isMine && checkbox}
      <div
        onClick={isSelecting ? onToggleSelect : undefined}
        className={`
          max-w-[75%] sm:max-w-[65%] rounded-2xl ${tailCornerClass} px-2.5 py-1.5 shadow-sm
          ${bubbleColor}
          ${hasError ? 'ring-1 ring-inset ring-red-400' : ''}
          ${isSelecting ? 'cursor-pointer' : ''}
          ${isSelected ? 'ring-2 ring-teal-500' : ''}
          relative
        `}
      >
        {isMine && isFirstInGroup && (message.sender === 'bot' || (message.sender === 'agent' && senderName)) && (
          <div className="text-xs font-semibold mb-0.5 text-teal-700 dark:text-teal-400">
            {displayName}
          </div>
        )}

        {isMedia ? (
          <MediaRenderer message={message} onLightbox={setLightboxSrc} onResolveUrl={onResolveMediaUrl} />
        ) : (
          <>
            {isTemplate && (
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-0.5">
                <span>📨</span>
                <span className="font-medium">
                  {bubble.templateLabel}{message.templateName ? ` — ${message.templateName}` : ''}
                </span>
              </p>
            )}
            <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words leading-[19px]">
              {parseWhatsAppFormatting(message.content ?? '')}
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-1 mt-0.5 select-none">
          <span className="text-xs text-black/40 dark:text-white/40 font-medium">
            {formatTimestamp(message.timestamp)}
          </span>
          {isMine && message.status && (
            <StatusTicks status={message.status} title={tooltipText} />
          )}
        </div>
      </div>
      {!isMine && checkbox}

      {lightboxSrc && (
        <Lightbox imageUrl={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  )
}
