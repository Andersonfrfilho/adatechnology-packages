import type { ParticipantConversationsLabels } from './participantLabels'
import { useParticipantFailedMenu } from './useParticipantFailedMenu'

type ParticipantFailedMenuProps = {
  readonly labels: ParticipantConversationsLabels
  readonly onEdit?: () => void
  readonly onDiscard?: () => void
}

export function ParticipantFailedMenu({ labels, onEdit, onDiscard }: ParticipantFailedMenuProps) {
  const menu = useParticipantFailedMenu()
  if (!onEdit && !onDiscard) return null

  function runAndClose(action: () => void): () => void {
    return () => {
      menu.close()
      action()
    }
  }

  return (
    <span className="cv-p-failed-menu" ref={menu.containerRef} onBlur={menu.handleBlur}>
      <button
        type="button"
        ref={menu.triggerRef}
        className="cv-p-failed-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={menu.state.isOpen}
        aria-label={labels.messageOptions}
        onClick={menu.handleTriggerClick}
        onKeyDown={menu.handleTriggerKeyDown}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {menu.state.isOpen ? (
        <div role="menu" ref={menu.menuRef} className="cv-p-failed-menu__list" onKeyDown={menu.handleMenuKeyDown}>
          {onEdit ? (
            <button type="button" role="menuitem" className="cv-p-failed-menu__item" onClick={runAndClose(onEdit)}>
              {labels.edit}
            </button>
          ) : null}
          {onDiscard ? (
            <button
              type="button"
              role="menuitem"
              className="cv-p-failed-menu__item cv-p-failed-menu__item--danger"
              onClick={runAndClose(onDiscard)}
            >
              {labels.discard}
            </button>
          ) : null}
        </div>
      ) : null}
    </span>
  )
}
