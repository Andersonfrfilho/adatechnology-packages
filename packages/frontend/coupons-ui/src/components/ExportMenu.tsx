/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ExportFormat } from '@adatechnology/coupon-contracts'
import { Download } from 'lucide-react'
import { useState } from 'react'

import { useCouponsText } from '../providers/CouponsProvider'

export type ExportScope = 'page' | 'all'

export type ExportMenuProps = {
  readonly onExport: (scope: ExportScope, format: ExportFormat) => Promise<void>
  /** Ausente: só "página atual" (o host não injetou a exportação do servidor). */
  readonly canExportAll: boolean
}

/** Duas opções sempre: a página que está na tela e todos os resultados do filtro. */
export function ExportMenu({ onExport, canExportAll }: ExportMenuProps) {
  const { messages } = useCouponsText()
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState(false)
  const options: { scope: ExportScope; format: ExportFormat; label: string }[] = [
    { scope: 'page', format: 'csv', label: messages.exportPageCsv },
    { scope: 'page', format: 'xlsx', label: messages.exportPageXlsx },
    ...(canExportAll
      ? [
          { scope: 'all' as const, format: 'csv' as const, label: messages.exportAllCsv },
          { scope: 'all' as const, format: 'xlsx' as const, label: messages.exportAllXlsx },
        ]
      : []),
  ]

  async function handleChoose(scope: ExportScope, format: ExportFormat): Promise<void> {
    setIsOpen(false)
    setError(false)
    try {
      await onExport(scope, format)
    } catch {
      setError(true)
    }
  }

  return (
    <div className="acp-menu">
      <button
        type="button"
        className="acp-button acp-button--ghost"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        <Download aria-hidden="true" className="acp-icon" />
        <span>{messages.export}</span>
      </button>
      {isOpen ? (
        <ul className="acp-menu-list" role="menu">
          {options.map((option) => (
            <li key={`${option.scope}-${option.format}`} role="none">
              <button
                type="button"
                role="menuitem"
                className="acp-menu-item"
                onClick={() => void handleChoose(option.scope, option.format)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className="acp-error" role="alert">
          {messages.exportError}
        </p>
      ) : null}
    </div>
  )
}
