/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ReactNode } from 'react'

import { cn } from './cn'

export interface WhatsAppMessagePreviewProps {
  /** Conteúdo dentro do balão (texto já formatado, anexos, botão de lista). */
  readonly children: ReactNode
  /** Abaixo do balão, ainda na coluna dele — botões de resposta, linhas de lista. */
  readonly belowBubble?: ReactNode
  /** Rodapé fora da coluna do balão, sobre o fundo. */
  readonly footer?: ReactNode
  readonly className?: string
}

/** Balão recebido sobre o fundo do WhatsApp — o único estilo de pré-visualização do pacote. */
export function WhatsAppMessagePreview({ children, belowBubble, footer, className }: WhatsAppMessagePreviewProps) {
  return (
    <div className={cn('rounded-xl bg-[#e5ddd5] dark:bg-gray-900 p-3 space-y-1.5', className)}>
      <div className="max-w-[85%]">
        <div className="rounded-lg rounded-tl-none bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm whitespace-pre-wrap break-words">
          {children}
        </div>
        {belowBubble}
      </div>
      {footer}
    </div>
  )
}
