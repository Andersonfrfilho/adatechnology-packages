import { EllipsisVertical } from 'lucide-react'
import { useId } from 'react'

import type { ParticipantMessageMenuState } from './ParticipantMessageMenuContext'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS as DEFAULTS } from './participantLabels'
import { conversationExportFileName, conversationExportText, downloadTextFile } from './participantMessageInfoModel'
import { useParticipantFailedMenu } from './useParticipantFailedMenu'

type ParticipantConversationMenuProps = {
  readonly state: ParticipantMessageMenuState
  /** Title of the conversation: first line of the file and its name. */
  readonly title: string
}

/**
 * The header's menu of a thread with `messageMenu`, as in common chat apps: enter selection mode with nothing
 * checked yet, or download the loaded messages as text (`[date time] author: text`, one per line).
 */
export function ParticipantConversationMenu({ state, title }: ParticipantConversationMenuProps) {
  const menu = useParticipantFailedMenu()
  const triggerId = useId()
  const { labels } = state
  const listClass = `cv-p-failed-menu__list cv-p-message-menu__list cv-p-conversation-menu__list${menu.placement === 'below' ? ' cv-p-failed-menu__list--below' : ''}`
  const entries = [
    { id: 'select', label: labels.selectMessages ?? DEFAULTS.selectMessages, run: () => state.start() },
    {
      id: 'download',
      label: labels.downloadConversation ?? DEFAULTS.downloadConversation,
      disabled: state.messages.length === 0,
      run: () =>
        downloadTextFile(
          conversationExportFileName(title),
          conversationExportText({ title, messages: state.messages, locale: state.locale, meLabel: labels.me }),
        ),
    },
  ]

  return (
    <span className="cv-p-conversation-menu" ref={menu.containerRef} onBlur={menu.handleBlur}>
      <button
        type="button"
        id={triggerId}
        ref={menu.triggerRef}
        className="cv-p-conversation-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={menu.state.isOpen}
        aria-label={labels.conversationOptions ?? DEFAULTS.conversationOptions}
        onClick={menu.handleTriggerClick}
        onKeyDown={menu.handleTriggerKeyDown}
      >
        <EllipsisVertical size={18} aria-hidden={true} />
      </button>
      {menu.state.isOpen ? (
        <div
          role="menu"
          aria-labelledby={triggerId}
          ref={menu.menuRef}
          className={listClass}
          onKeyDown={menu.handleMenuKeyDown}
        >
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="cv-p-failed-menu__item cv-p-message-menu__item"
              disabled={entry.disabled}
              onClick={() => {
                menu.close()
                entry.run()
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  )
}
