import type { ParticipantFailedMenuController } from './useParticipantFailedMenu'
import type { ParticipantConversationsLabels } from './participantLabels'

type ParticipantFailedMenuListProps = {
  readonly menu: ParticipantFailedMenuController
  readonly labelledBy: string
  readonly labels: ParticipantConversationsLabels
  readonly onEdit?: () => void
  readonly onDiscard?: () => void
}

export function ParticipantFailedMenuList({ menu, labelledBy, labels, onEdit, onDiscard }: ParticipantFailedMenuListProps) {
  function runAndClose(action: () => void): () => void {
    return () => {
      menu.close()
      action()
    }
  }

  const className = `cv-p-failed-menu__list${menu.placement === 'below' ? ' cv-p-failed-menu__list--below' : ''}`
  return (
    <div role="menu" aria-labelledby={labelledBy} ref={menu.menuRef} className={className} onKeyDown={menu.handleMenuKeyDown}>
      {onEdit ? (
        <button type="button" role="menuitem" tabIndex={-1} className="cv-p-failed-menu__item" onClick={runAndClose(onEdit)}>
          {labels.edit}
        </button>
      ) : null}
      {onDiscard ? (
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="cv-p-failed-menu__item cv-p-failed-menu__item--danger"
          onClick={runAndClose(onDiscard)}
        >
          {labels.discard}
        </button>
      ) : null}
    </div>
  )
}
