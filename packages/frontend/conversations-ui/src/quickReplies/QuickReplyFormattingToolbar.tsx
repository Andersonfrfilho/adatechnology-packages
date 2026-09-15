/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Bold, Code, Italic, List, ListOrdered, Quote, SquareCode, Strikethrough } from 'lucide-react'

import { COMPOSER_TOOL_BUTTON_CLASS, COMPOSER_TOOL_BUTTON_IDLE_CLASS } from '../composer.constant'
import { cn } from '../lib/cn'
import type { ResolvedQuickRepliesWorkspaceLabels } from './labels'
import {
  FORMATTING_SHORTCUT_HINT,
  QUICK_REPLY_FORMATTING_ACTION as ACTION,
  type QuickReplyFormattingAction,
} from './quickReplyFormatting'

export interface QuickReplyFormattingToolbarProps {
  readonly labels: Pick<
    ResolvedQuickRepliesWorkspaceLabels,
    | 'formatBold'
    | 'formatItalic'
    | 'formatStrikethrough'
    | 'formatMonospace'
    | 'formatInlineCode'
    | 'formatBulletedList'
    | 'formatNumberedList'
    | 'formatQuote'
    | 'formattingToolbar'
  >
  readonly onFormat: (action: QuickReplyFormattingAction) => void
}

export function QuickReplyFormattingToolbar({ labels, onFormat }: QuickReplyFormattingToolbarProps) {
  const buttons = [
    { action: ACTION.BOLD, label: labels.formatBold, Icon: Bold },
    { action: ACTION.ITALIC, label: labels.formatItalic, Icon: Italic },
    { action: ACTION.STRIKETHROUGH, label: labels.formatStrikethrough, Icon: Strikethrough },
    { action: ACTION.MONOSPACE, label: labels.formatMonospace, Icon: SquareCode },
    { action: ACTION.INLINE_CODE, label: labels.formatInlineCode, Icon: Code },
    { action: ACTION.BULLETED_LIST, label: labels.formatBulletedList, Icon: List },
    { action: ACTION.NUMBERED_LIST, label: labels.formatNumberedList, Icon: ListOrdered },
    { action: ACTION.QUOTE, label: labels.formatQuote, Icon: Quote },
  ] as const

  return (
    <div role="toolbar" aria-label={labels.formattingToolbar} className="flex flex-wrap gap-1">
      {buttons.map(({ action, label, Icon }) => (
        <button
          key={action}
          type="button"
          aria-label={label}
          title={FORMATTING_SHORTCUT_HINT[action] ? `${label} (${FORMATTING_SHORTCUT_HINT[action]})` : label}
          // Clicar tiraria o foco do campo e perderia a seleção antes do wrap.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onFormat(action)}
          className={cn(COMPOSER_TOOL_BUTTON_CLASS, COMPOSER_TOOL_BUTTON_IDLE_CLASS)}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
