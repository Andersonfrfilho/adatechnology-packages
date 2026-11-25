/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { POST_STATUS, type PostStatus } from '@adatechnology/content-contracts'
import { Archive, CalendarClock, CircleCheck, PencilLine, type LucideIcon } from 'lucide-react'

import type { ContentMessages } from '../locales'
import { useContentText } from '../providers/ContentProvider'

// Estado = ícone + palavra + cor: nunca só a cor, que some para daltônico e em impressão.
const STATUS_VIEW: Record<PostStatus, { readonly icon: LucideIcon; readonly label: keyof ContentMessages }> = {
  [POST_STATUS.DRAFT]: { icon: PencilLine, label: 'statusDraft' },
  [POST_STATUS.SCHEDULED]: { icon: CalendarClock, label: 'statusScheduled' },
  [POST_STATUS.PUBLISHED]: { icon: CircleCheck, label: 'statusPublished' },
  [POST_STATUS.ARCHIVED]: { icon: Archive, label: 'statusArchived' },
}

export type StatusChipProps = { readonly status: PostStatus }

export function StatusChip({ status }: StatusChipProps) {
  const { messages } = useContentText()
  const { icon: Icon, label } = STATUS_VIEW[status]
  return (
    <span className={`adc-chip adc-chip--${status}`}>
      <Icon aria-hidden="true" className="adc-icon" />
      {messages[label]}
    </span>
  )
}
