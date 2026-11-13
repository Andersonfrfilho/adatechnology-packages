/**
 * Aviso de janela de 24h expirada, no lugar do composer.
 *
 * Trocar o composer pelo aviso, em vez de deixar o campo lá e falhar no envio, é o ponto: fora da
 * janela o WhatsApp recusa texto livre, e um campo habilitado promete algo que a plataforma não
 * cumpre. O caminho que resta — template — fica visível na mesma altura da tela.
 */

import { AlarmClock, Send } from 'lucide-react'

import { CONVERSATION_WINDOW, type ConversationWindow } from './conversationWindow'
import { ICON_SIZE_ACTION, ICON_SIZE_INLINE } from './icon.constant'
import { cn } from './lib/cn'

export interface WindowExpiredNoticeLabels {
  title: string
  description: string
  sendTemplate: string
}

// Sem emoji no rótulo: o ícone vem ao lado, da mesma biblioteca do resto da tela.
export const DEFAULT_WINDOW_EXPIRED_LABELS: WindowExpiredNoticeLabels = {
  title: 'Janela de 24h expirada — o WhatsApp não aceita mensagens livres.',
  description: 'Envie uma mensagem de template para reabrir a conversa com o cliente.',
  sendTemplate: 'Enviar Template (HSM)',
}

export interface WindowExpiredNoticeProps {
  onSendTemplate?: () => void
  disabled?: boolean
  labels?: Partial<WindowExpiredNoticeLabels>
  className?: string
}

export function WindowExpiredNotice({
  onSendTemplate,
  disabled = false,
  labels: labelsOverride,
  className,
}: WindowExpiredNoticeProps) {
  const labels = { ...DEFAULT_WINDOW_EXPIRED_LABELS, ...labelsOverride }

  return (
    <div role="status" className={cn('border-t bg-yellow-50 px-4 py-3 text-sm dark:bg-yellow-950', className)}>
      <p className="flex items-center gap-2 font-medium text-yellow-900 dark:text-yellow-200">
        <AlarmClock size={ICON_SIZE_INLINE} aria-hidden="true" className="shrink-0" />
        {labels.title}
      </p>
      <p className="text-yellow-800 dark:text-yellow-300">{labels.description}</p>
      {onSendTemplate ? (
        <button data-cv-tooltip={labels.sendTemplate} aria-label={labels.sendTemplate} type="button" onClick={onSendTemplate} disabled={disabled} className="cv-header-action mt-2">
          <Send size={ICON_SIZE_ACTION} aria-hidden="true" />
          {labels.sendTemplate}
        </button>
      ) : null}
    </div>
  )
}

/**
 * Só a faixa `expired` bloqueia: 21-24h ainda aceita texto livre e merece alerta, não impedimento.
 */
export function isWindowBlocking(window: ConversationWindow): boolean {
  return window === CONVERSATION_WINDOW.EXPIRED
}
