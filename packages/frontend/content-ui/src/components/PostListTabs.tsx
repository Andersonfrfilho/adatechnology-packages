/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PostCounts } from '@adatechnology/content-contracts'
import { CalendarClock, CircleCheck, Copy, PencilLine, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { POST_LIST_TAB, type PostListTab } from '../hooks/usePostList'
import type { ContentMessages } from '../locales'
import { useContentText } from '../providers/ContentProvider'

// Cada aba é ícone + palavra + número; a cor do estado acompanha, nunca sozinha.
const TABS: readonly {
  readonly id: PostListTab
  readonly icon: LucideIcon
  readonly label: keyof ContentMessages
  readonly count: keyof PostCounts
}[] = [
  { id: POST_LIST_TAB.PUBLISHED, icon: CircleCheck, label: 'tabPublished', count: 'published' },
  { id: POST_LIST_TAB.SCHEDULED, icon: CalendarClock, label: 'tabScheduled', count: 'scheduled' },
  { id: POST_LIST_TAB.DRAFT, icon: PencilLine, label: 'tabDraft', count: 'draft' },
  { id: POST_LIST_TAB.TEMPLATES, icon: Copy, label: 'tabTemplates', count: 'templates' },
]

export type PostListTabsProps = {
  readonly active: PostListTab
  readonly counts: PostCounts | undefined
  readonly onChange: (tab: PostListTab) => void
}

export function PostListTabs({ active, counts, onChange }: PostListTabsProps): ReactNode {
  const { messages } = useContentText()
  return (
    <div className="adc-status-tabs" role="tablist" aria-label={messages.tabsLabel}>
      {TABS.map(({ id, icon: Icon, label, count }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={id === active}
          className={`adc-status-tab adc-status-tab--${id}`}
          onClick={() => onChange(id)}
        >
          <Icon aria-hidden="true" className="adc-icon" />
          <span>{messages[label]}</span>
          <span className="adc-status-tab__count">{counts ? counts[count] : '–'}</span>
        </button>
      ))}
    </div>
  )
}
