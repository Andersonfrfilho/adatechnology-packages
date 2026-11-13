import { useMemo } from 'react'
import { CHAT_TEXT_PRIMARY_CLASS, CHAT_TEXT_SECONDARY_CLASS } from './theme'
import { Avatar } from './Avatar'
import { contactFlag, formatContactHandle } from './conversationChannel'
import type { ConversationSummary } from './providers/types'

export interface ConversationListItemLabels {
  /** Tooltip do ponto vermelho: a janela de atendimento de 24h já fechou. */
  expiredWindow: string
  /** Tooltip do ponto laranja: a janela de atendimento está perto de fechar. */
  warningWindow: string
}

export const DEFAULT_CONVERSATION_LIST_ITEM_LABELS: ConversationListItemLabels = {
  expiredWindow: 'Janela expirada',
  warningWindow: 'Janela próxima do fim',
}

export interface ConversationListItemProps {
  conversation: ConversationSummary
  labels?: Partial<ConversationListItemLabels>
  active?: boolean
  selected?: boolean
  onClick?: () => void
  onSelect?: (id: string) => void
  /**
   * Desliga a borda inferior quando o item é composto dentro de outra linha (ver `ConversationRow`):
   * com ela ligada, a borda corta a própria linha ao meio, separando o item do rodapé de status.
   */
  showDivider?: boolean
  /**
   * Desliga o fundo de selecionado. Par do `showDivider`: quando o item é composto dentro de uma
   * linha maior, quem pinta o realce é a linha — senão só o bloco do item fica cinza e o resto
   * (checkbox, pills, barra lateral) continua branco, como se metade da linha estivesse selecionada.
   */
  highlightActive?: boolean
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
  showDivider = true,
  highlightActive = true,
  labels,
}: ConversationListItemProps) => {
  const expiredWindowLabel = labels?.expiredWindow ?? DEFAULT_CONVERSATION_LIST_ITEM_LABELS.expiredWindow
  const warningWindowLabel = labels?.warningWindow ?? DEFAULT_CONVERSATION_LIST_ITEM_LABELS.warningWindow
  const isActive = active || selected
  const windowStatus = useMemo(() => getWindowStatus(conversation.lastInboundAt), [conversation.lastInboundAt])
  const preview = useMemo(() => lastMessagePreview(conversation), [conversation.lastContent])
  // `contactId` é o identificador neutro; `whatsappNumber` fica como fallback enquanto o backend
  // não informa canal.
  const handle = conversation.contactId ?? conversation.whatsappNumber
  const displayHandle = formatContactHandle({ handle, channel: conversation.channel })
  const name = conversation.clientName || displayHandle || handle
  const timestamp = formatRelativeTime(conversation.lastAt)
  const flag = contactFlag({ handle, channel: conversation.channel })
  const isInbound = conversation.lastDirection === 'inbound'

  const handleClick = () => {
    onClick?.()
    onSelect?.(conversation.id)
  }

  return (
    <button
      data-cv-tooltip={name} aria-label={name}
      onClick={handleClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${highlightActive ? "hover:bg-[#f0f2f5]" : ""} ${showDivider ? "border-b border-[#e9edef]" : ""}`}
      style={{
        backgroundColor: isActive && highlightActive ? '#f0f2f5' : 'transparent',
      }}
    >
      <div className="relative flex-shrink-0">
        {/* Só o nome do cliente: passar o telefone faria o avatar exibir dígitos soltos em vez da
            silhueta de contato sem nome. */}
        <Avatar name={conversation.clientName} size="lg" />
        {conversation.waitingHuman && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-white" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Sem nome, o título já é o telefone — a bandeira vai nele. */}
            {!conversation.clientName && flag ? <span aria-hidden>{flag}</span> : null}
            <span className={`text-[16px] ${CHAT_TEXT_PRIMARY_CLASS} truncate`}>{name}</span>
            {windowStatus && windowStatus.label === 'expired' && (
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" data-cv-tooltip={expiredWindowLabel} />
            )}
            {windowStatus && windowStatus.label === 'warning' && (
              <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" data-cv-tooltip={warningWindowLabel} />
            )}
          </div>
          {timestamp && (
            <span className={`text-xs ${CHAT_TEXT_SECONDARY_CLASS} flex-shrink-0`}>{timestamp}</span>
          )}
        </div>
        {/* Telefone só como subtítulo quando o título é o nome — repetir o número embaixo dele
            mesmo gastaria uma linha para dizer duas vezes a mesma coisa. */}
        {conversation.clientName ? (
          <div className={`flex items-center gap-1 text-xs ${CHAT_TEXT_SECONDARY_CLASS}`}>
            {flag ? <span aria-hidden>{flag}</span> : null}
            <span className="truncate">{displayHandle}</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between mt-0.5">
          <span className={`text-sm ${CHAT_TEXT_SECONDARY_CLASS} truncate max-w-[180px]`}>
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
