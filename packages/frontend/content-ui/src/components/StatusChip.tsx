/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { POST_STATUS, type PostStatus } from '@adatechnology/content-contracts'
import { Archive, CalendarClock, CircleCheck, Copy, PencilLine, type LucideIcon } from 'lucide-react'

import type { ContentMessages } from '../locales'
import { useContentText } from '../providers/ContentProvider'

// Estado = ícone + palavra + cor: nunca só a cor, que some para daltônico e em impressão.
const STATUS_VIEW: Record<PostStatus, { readonly icon: LucideIcon; readonly label: keyof ContentMessages }> = {
  [POST_STATUS.DRAFT]: { icon: PencilLine, label: 'statusDraft' },
  [POST_STATUS.SCHEDULED]: { icon: CalendarClock, label: 'statusScheduled' },
  [POST_STATUS.PUBLISHED]: { icon: CircleCheck, label: 'statusPublished' },
  [POST_STATUS.ARCHIVED]: { icon: Archive, label: 'statusArchived' },
}

export type StatusChipProps = {
  readonly status: PostStatus
  /** Modelo mostra "Modelo" no lugar do status (ele nunca vai ao ar). */
  readonly isTemplate?: boolean
}

export function StatusChip({ status, isTemplate = false }: StatusChipProps) {
  const { messages } = useContentText()
  const { icon: Icon, label } = isTemplate ? { icon: Copy, label: 'statusTemplate' as const } : STATUS_VIEW[status]
  return (
    <span className={`adc-badge adc-chip--${isTemplate ? 'template' : status}`}>
      <Icon aria-hidden="true" className="adc-icon" />
      {messages[label]}
    </span>
  )
}
