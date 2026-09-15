import { Bold, Code, Italic, Strikethrough } from 'lucide-react'

import { COMPOSER_TOOL_BUTTON_CLASS, COMPOSER_TOOL_BUTTON_IDLE_CLASS } from '../composer.constant'
import { cn } from '../lib/cn'
import { FORMATTING_ACTION, type FormattingAction } from '../lib/composer-formatting'
import type { QuickRepliesWorkspaceLabels } from './labels'

export interface QuickReplyFormattingToolbarProps {
  readonly labels: Pick<
    QuickRepliesWorkspaceLabels,
    'formatBold' | 'formatItalic' | 'formatStrikethrough' | 'formatMonospace' | 'formattingToolbar'
  >
  readonly onFormat: (action: FormattingAction) => void
}

export function QuickReplyFormattingToolbar({ labels, onFormat }: QuickReplyFormattingToolbarProps) {
  const buttons = [
    { action: FORMATTING_ACTION.BOLD, label: labels.formatBold, Icon: Bold },
    { action: FORMATTING_ACTION.ITALIC, label: labels.formatItalic, Icon: Italic },
    { action: FORMATTING_ACTION.STRIKETHROUGH, label: labels.formatStrikethrough, Icon: Strikethrough },
    { action: FORMATTING_ACTION.MONOSPACE, label: labels.formatMonospace, Icon: Code },
  ] as const

  return (
    <div role="toolbar" aria-label={labels.formattingToolbar} className="flex gap-1">
      {buttons.map(({ action, label, Icon }) => (
        <button
          key={action}
          type="button"
          aria-label={label}
          title={label}
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
