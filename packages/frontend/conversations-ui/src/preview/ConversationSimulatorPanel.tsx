/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Painel lateral do simulador de cliente: a moldura em volta do `ConversationPreview`.
 *
 * Existe como componente do pacote porque cada produto tinha reescrito a mesma moldura —
 * `<aside>`, cabeçalho com título e telefone, botão de fechar — e as cópias divergiram. Uma delas
 * migrou para o cliente-ponte (assinatura no servidor) e a outra ficou assinando no navegador, com
 * o app secret publicado no bundle. É o tipo de correção que precisa chegar a todo mundo de uma vez.
 *
 * Mora DENTRO da tela de conversas, e não numa aba própria, por um motivo prático: o token do
 * atendente costuma viver em `sessionStorage`, que é por aba. Numa aba separada o simulador nascia
 * sem sessão, o transcript nunca carregava, e o sintoma era "mandei e não aconteceu nada".
 *
 * O efeito de cada envio aparece na thread ao lado pelo mesmo stream que a inbox já assina — este
 * painel não abre conexão própria.
 */

import type { ReactNode } from 'react'

import { ConversationPreview, type ConversationPreviewProps } from './ConversationPreview'

export type ConversationSimulatorPanelLabels = {
  readonly title: string
  /** Complementa o telefone no subtítulo, explicando para onde a mensagem realmente vai. */
  readonly destinationHint: string
  readonly close: string
  readonly placeholder: string
}

export const DEFAULT_CONVERSATION_SIMULATOR_PANEL_LABELS: ConversationSimulatorPanelLabels = {
  title: 'Simulador do cliente',
  destinationHint: 'entrega no webhook real',
  close: 'Fechar simulador',
  placeholder: 'Escreva como o cliente…',
}

export type ConversationSimulatorPanelProps = Omit<ConversationPreviewProps, 'placeholder'> & {
  readonly onClose: () => void
  /**
   * Telefone já formatado para leitura. É o host que formata: máscara de telefone é convenção
   * regional, e o pacote não tem como saber a do produto.
   */
  readonly displayNumber?: string
  readonly labels?: Partial<ConversationSimulatorPanelLabels>
  /** Ações extras no cabeçalho — roteiro automático, limpar conversa, trocar de contato. */
  readonly headerActions?: ReactNode
}

export function ConversationSimulatorPanel({
  onClose,
  displayNumber,
  labels,
  headerActions,
  ...previewProps
}: ConversationSimulatorPanelProps) {
  const text = { ...DEFAULT_CONVERSATION_SIMULATOR_PANEL_LABELS, ...labels }
  const subtitle = [displayNumber ?? previewProps.conversationId, text.destinationHint].join(' · ')

  return (
    <aside className="cv-simulator-panel" aria-label={text.title}>
      <header className="cv-simulator-panel__header">
        <div className="cv-simulator-panel__heading">
          <h2 className="cv-simulator-panel__title">{text.title}</h2>
          <p className="cv-simulator-panel__subtitle">{subtitle}</p>
        </div>
        <div className="cv-simulator-panel__actions">
          {headerActions}
          <button type="button" onClick={onClose} title={text.close} aria-label={text.close} className="cv-simulator-panel__close">
            {/* SVG inline em vez de lucide-react: o pacote não impõe biblioteca de ícone ao host. */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      <div className="cv-simulator-panel__body">
        <ConversationPreview {...previewProps} placeholder={text.placeholder} />
      </div>
    </aside>
  )
}
