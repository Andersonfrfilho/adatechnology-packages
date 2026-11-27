/**
 * Faixa de botões com as mensagens prontas, no topo da conversa. Clicar insere o texto no campo
 * (nunca envia): o atendente confere e manda. O que não cabe vai para o menu "Mais".
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import type { QuickReply } from './quickReply.types'

export const DEFAULT_QUICK_REPLIES_BAR_MAX_VISIBLE = 4

export interface QuickRepliesBarLabels {
  readonly toolbar: string
  readonly more: string
  readonly moreMenu: string
}

export const DEFAULT_QUICK_REPLIES_BAR_LABELS: QuickRepliesBarLabels = {
  toolbar: 'Mensagens prontas',
  more: 'Mais',
  moreMenu: 'Mais mensagens prontas',
}

export interface QuickRepliesBarProps {
  readonly items: readonly QuickReply[]
  readonly onSelect: (quickReply: QuickReply) => void
  readonly maxVisible?: number
  readonly labels?: Partial<QuickRepliesBarLabels>
  readonly className?: string
}

/** Os primeiros cabem na faixa; o resto vai para o menu. Teto abaixo de 1 vira 1: faixa sem botão não serve. */
export function splitQuickReplies<TItem>(items: readonly TItem[], maxVisible: number): { visible: TItem[]; overflow: TItem[] } {
  const limit = Math.max(1, Math.floor(maxVisible))
  return { visible: items.slice(0, limit), overflow: items.slice(limit) }
}

export function QuickRepliesBar({ items, onSelect, maxVisible = DEFAULT_QUICK_REPLIES_BAR_MAX_VISIBLE, labels, className }: QuickRepliesBarProps): ReactNode {
  const text = { ...DEFAULT_QUICK_REPLIES_BAR_LABELS, ...labels }
  const menuId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const { visible, overflow } = splitQuickReplies(items, maxVisible)

  useEffect(() => {
    if (!isOpen) return undefined
    function handlePointerDown(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  if (items.length === 0) return null

  function closeMenu(): void {
    setIsOpen(false)
    moreRef.current?.focus()
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const entries = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    const index = entries.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'ArrowDown' ? (index + 1) % entries.length : (index - 1 + entries.length) % entries.length
    entries[next]?.focus()
  }

  function handleSelect(quickReply: QuickReply): void {
    setIsOpen(false)
    onSelect(quickReply)
  }

  return (
    <div ref={rootRef} role="toolbar" aria-label={text.toolbar} className={className ? `cv-qr-bar ${className}` : 'cv-qr-bar'}>
      {visible.map((quickReply) => (
        <button key={quickReply.id} type="button" className="cv-qr-bar-button" title={quickReply.body} onClick={() => handleSelect(quickReply)}>
          {quickReply.title}
        </button>
      ))}
      {overflow.length > 0 ? (
        <div className="cv-qr-bar-more">
          <button
            ref={moreRef}
            type="button"
            className="cv-qr-bar-button cv-qr-bar-button--more"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-controls={isOpen ? menuId : undefined}
            aria-label={text.moreMenu}
            onClick={() => setIsOpen((current) => !current)}
          >
            {text.more} <span aria-hidden="true">▾</span>
          </button>
          {isOpen ? (
            <div id={menuId} role="menu" aria-label={text.moreMenu} className="cv-qr-bar-menu" onKeyDown={handleMenuKeyDown}>
              {overflow.map((quickReply, index) => (
                <button key={quickReply.id} type="button" role="menuitem" className="cv-qr-bar-item" autoFocus={index === 0} onClick={() => handleSelect(quickReply)}>
                  {quickReply.title}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
