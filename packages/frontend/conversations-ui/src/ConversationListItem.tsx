import { useMemo } from 'react'
import { Avatar } from './Avatar'
import { formatPhone } from './lib/phone'
import type { ConversationSummary } from './providers/types'

export interface ConversationListItemProps {
  conversation: ConversationSummary
  active?: boolean
  selected?: boolean
  onClick?: () => void
  onSelect?: (id: string) => void
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60_000)
    const diffHours = Math.floor(diffMs / 3_600_000)
    const diffDays = Math.floor(diffMs / 86_400_000)

    if (diffMins < 1) return 'Agora'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    return `${day}/${month}`
  } catch {
    return ''
  }
}

function getWindowStatus(lastInboundAt: string | null): { label: string; color: string } | null {
  if (!lastInboundAt) return null

  try {
    const lastInbound = new Date(lastInboundAt).getTime()
    const now = Date.now()
    const hoursElapsed = (now - lastInbound) / 3_600_000

    if (hoursElapsed <= 12) return { label: 'active', color: '#22c55e' }
    if (hoursElapsed <= 21) return { label: 'approaching', color: '#eab308' }
    if (hoursElapsed <= 24) return { label: 'warning', color: '#f97316' }
    return { label: 'expired', color: '#ef4444' }
  } catch {
    return null
  }
}

function lastMessagePreview(conversation: ConversationSummary): { icon: string | null; preview: string } {
  if (!conversation.lastContent) return { icon: null, preview: '' }

  const content = conversation.lastContent

  if (content.startsWith('[image]') || content.startsWith('[Image]')) {
    return { icon: '\u{1F5BC}', preview: 'Imagem' }
  }
  if (content.startsWith('[video]') || content.startsWith('[Video]')) {
    return { icon: '\u{1F3AC}', preview: 'Vídeo' }
  }
  if (content.startsWith('[audio]') || content.startsWith('[Audio]')) {
    return { icon: '\u{1F3A4}', preview: 'Áudio' }
  }
  if (content.startsWith('[document]') || content.startsWith('[Document]')) {
    return { icon: '\u{1F4C4}', preview: 'Documento' }
  }
  if (content.startsWith('[sticker]') || content.startsWith('[Sticker]')) {
    return { icon: '\u{1F3AF}', preview: 'Sticker' }
  }

  return { icon: null, preview: content }
}

export const ConversationListItem = ({
  conversation,
  active = false,
  selected = false,
  onClick,
  onSelect,
}: ConversationListItemProps) => {
  const isActive = active || selected
  const windowStatus = useMemo(() => getWindowStatus(conversation.lastInboundAt), [conversation.lastInboundAt])
  const preview = useMemo(() => lastMessagePreview(conversation), [conversation.lastContent])
  const name = conversation.clientName || formatPhone(conversation.whatsappNumber) || conversation.whatsappNumber
  const timestamp = formatRelativeTime(conversation.lastAt)
  const isInbound = conversation.lastDirection === 'inbound'

  const handleClick = () => {
    onClick?.()
    onSelect?.(conversation.id)
  }

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#f0f2f5] border-b border-[#e9edef]"
      style={{
        backgroundColor: isActive ? '#f0f2f5' : 'transparent',
      }}
    >
      <div className="relative flex-shrink-0">
        <Avatar name={name} size="lg" />
        {conversation.waitingHuman && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-white" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[16px] text-[#111b21] truncate">{name}</span>
            {windowStatus && windowStatus.label === 'expired' && (
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Janela expirada" />
            )}
            {windowStatus && windowStatus.label === 'warning' && (
              <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" title="Janela próxima do fim" />
            )}
          </div>
          {timestamp && (
            <span className="text-xs text-[#667781] flex-shrink-0">{timestamp}</span>
          )}
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-sm text-[#667781] truncate max-w-[180px]">
            {preview.icon && <span className="mr-1">{preview.icon}</span>}
            {preview.preview || 'Sem mensagens'}
          </span>
          {conversation.unread > 0 && (
            <span className="bg-[#25d366] text-white text-xs font-semibold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center flex-shrink-0 ml-2">
              {conversation.unread > 99 ? '99+' : conversation.unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          {conversation.mode === 'human' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-100 text-purple-700">Humano</span>
          )}
          {conversation.mode === 'bot' && conversation.waitingHuman && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700">Aguardando</span>
          )}
        </div>
      </div>
    </button>
  )
}
