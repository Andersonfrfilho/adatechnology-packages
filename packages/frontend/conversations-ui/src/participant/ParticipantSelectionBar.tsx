import { X } from 'lucide-react'

import type { ParticipantMessageMenuState } from './ParticipantMessageMenuContext'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS as DEFAULTS, formatParticipantLabel } from './participantLabels'
import { formatMessagesForCopy, selectedInOrder } from './participantMessageMenuModel'
import { useParticipantCopyFeedback } from './useParticipantCopyFeedback'

/**
 * Takes the composer's place while messages are selected: how many, Copy (with date, time and author, one
 * line each) and the host's actions, all in conversation order. The close button and Escape leave the mode.
 */
export function ParticipantSelectionBar({ state }: { readonly state: ParticipantMessageMenuState }) {
  const { labels } = state
  const { copy } = useParticipantCopyFeedback()
  const selected = selectedInOrder(state.messages, state.selectedIds)
  const count = formatParticipantLabel(labels.selectedCount ?? DEFAULTS.selectedCount ?? '{count}', selected.length)
  const actions = state.options.selectionActions?.(selected) ?? []
  const isEmpty = selected.length === 0

  function copySelected(): void {
    copy(
      formatMessagesForCopy(selected, {
        locale: state.locale,
        meLabel: labels.me,
        transcriptionLabel: labels.transcriptionPrefix ?? DEFAULTS.transcriptionPrefix,
      }),
      labels.valueCopied,
    )
    state.clear()
  }

  return (
    <div className="cv-p-selection-bar" role="toolbar" aria-label={count}>
      <button
        type="button"
        className="cv-p-selection-bar__close"
        aria-label={labels.cancelSelection ?? DEFAULTS.cancelSelection}
        onClick={state.clear}
      >
        <X size={18} aria-hidden={true} />
      </button>
      <span className="cv-p-selection-bar__count" aria-live="polite">
        {count}
      </span>
      <button type="button" className="cv-p-selection-bar__action" disabled={isEmpty} onClick={copySelected}>
        {labels.copyMessage ?? DEFAULTS.copyMessage}
      </button>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className="cv-p-selection-bar__action"
          disabled={isEmpty || action.disabled}
          onClick={() => {
            action.onSelect(selected)
            state.clear()
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
